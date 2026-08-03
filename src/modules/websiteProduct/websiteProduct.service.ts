import prisma from "../../config/db.js"; // ⚠️ apna actual prisma import path daalo
import { Prisma } from "@prisma/client";
import { formatImageUrl } from "../../utils/formatImageUrl.js"; // ⚠️ apna actual path daalo
//import { formatImageUrl, formatImageUrls } from "../../utils/formatImageUrl";

function parseImages(images: any): string[] {
  if (Array.isArray(images)) return images;
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Category + saare descendant category IDs nikalne ke liye (self-referential tree)
async function getCategoryAndDescendantIds(slug: string): Promise<string[]> {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!category) return [];

  const ids: string[] = [category.id];

  async function collectChildren(parentId: string) {
    const children = await prisma.category.findMany({
      where: { parentId },
      select: { id: true },
    });
    for (const child of children) {
      ids.push(child.id);
      await collectChildren(child.id);
    }
  }

  await collectChildren(category.id);
  return ids;
}

export interface WebsiteProductQuery {
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  attributes?: Record<string, string[]>; // { Color: ["Red","Blue"], Size: ["M"] }
  sort?: "price_asc" | "price_desc" | "newest" | "rating";
  page?: number;
  limit?: number;
}

export async function getAllWebsiteProductsService(query: WebsiteProductQuery) {
  const {
    category,
    search,
    minPrice,
    maxPrice,
    attributes,
    sort = "newest",
    page = 1,
    limit = 20,
  } = query;

  const where: Prisma.ProductWhereInput = { isActive: true };

  if (category) {
    const categoryIds = await getCategoryAndDescendantIds(category);
    if (categoryIds.length === 0) {
      return { products: [], total: 0, page, limit };
    }
    where.categoryId = { in: categoryIds };
  }

  if (search) {
    where.OR = [
      { name: { contains: search} },
      { description: { contains: search} },
    ];
  }

  if (attributes && Object.keys(attributes).length > 0) {
    where.AND = Object.entries(attributes).map(([attrName, values]) => ({
      variants: {
        some: {
          attributeValues: {
            some: {
              attributeValue: {
                attribute: { name: attrName },
                value: { in: values },
              },
            },
          },
        },
      },
    }));
  }

  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      images: true,
      price: true,
      stock: true,
      createdAt: true,
      category: { select: { id: true, name: true, slug: true } },
      variants: { select: { price: true, stock: true } },
      reviews: { where: { isApproved: true }, select: { rating: true } },
    },
  });

  let result = products.map((p) => {
    const hasVariants = p.variants.length > 0;
    const displayPrice = hasVariants
      ? Math.min(...p.variants.map((v) => Number(v.price)))
      : Number(p.price);
    const inStock = hasVariants ? p.variants.some((v) => v.stock > 0) : p.stock > 0;
    const reviewCount = p.reviews.length;
    const avgRating =
      reviewCount > 0
        ? Number((p.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1))
        : 0;

    const imgs = parseImages(p.images);
    const image = imgs.length > 0 ? formatImageUrl(imgs[0]) : null;

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      image,
      displayPrice,
      hasVariants,
      inStock,
      avgRating,
      reviewCount,
      createdAt: p.createdAt,
      category: p.category,
    };
  });

  if (minPrice !== undefined) {
    result = result.filter((p) => p.displayPrice >= minPrice);
  }
  if (maxPrice !== undefined) {
    result = result.filter((p) => p.displayPrice <= maxPrice);
  }

  if (sort === "price_asc") {
    result.sort((a, b) => a.displayPrice - b.displayPrice);
  } else if (sort === "price_desc") {
    result.sort((a, b) => b.displayPrice - a.displayPrice);
  } else if (sort === "rating") {
    result.sort((a, b) => b.avgRating - a.avgRating);
  } else {
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // newest
  }

  // Array.sort stable hai (V8) — isliye inStock ko last mein sort karne se
  // upar wala order (price/rating/newest) group ke andar preserve rehta hai,
  // sirf out-of-stock products neeche push ho jaate hain
  result.sort((a, b) => Number(b.inStock) - Number(a.inStock));

  const total = result.length;
  const start = (page - 1) * limit;
  const paginated = result.slice(start, start + limit);

  return { products: paginated, total, page, limit };
}

export async function getWebsiteProductBySlugService(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: { select: { id: true, name: true, slug: true, taxRate: true } },
      variants: {
        include: {
          attributeValues: {
            include: { attributeValue: { include: { attribute: true } } },
          },
        },
      },
      reviews: {
        where: { isApproved: true },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!product || !product.isActive) {
    throw new Error("Product not found");
  }

  const hasVariants = product.variants.length > 0;
  const displayPrice = hasVariants
    ? Math.min(...product.variants.map((v) => Number(v.price)))
    : Number(product.price);

  const reviewCount = product.reviews.length;
  const avgRating =
    reviewCount > 0
      ? Number(
          (product.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1)
        )
      : 0;

  const variants = product.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    price: Number(v.price),
    stock: v.stock,
    attributes: v.attributeValues.map((vav) => ({
      attributeName: vav.attributeValue.attribute.name,
      value: vav.attributeValue.value,
    })),
  }));

  const attributeOptions: Record<string, string[]> = {};
  for (const v of variants) {
    for (const attr of v.attributes) {
      if (!attributeOptions[attr.attributeName]) attributeOptions[attr.attributeName] = [];
      if (!attributeOptions[attr.attributeName].includes(attr.value)) {
        attributeOptions[attr.attributeName].push(attr.value);
      }
    }
  }

  const relatedRaw = product.categoryId
    ? await prisma.product.findMany({
        where: { categoryId: product.categoryId, isActive: true, id: { not: product.id } },
        select: {
          id: true,
          name: true,
          slug: true,
          images: true,
          price: true,
          variants: { select: { price: true } },
        },
        take: 6,
      })
    : [];

const relatedProducts = relatedRaw.map((p) => {
  const imgs = parseImages(p.images);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    image: imgs.length > 0 ? formatImageUrl(imgs[0]) : null,
    displayPrice:
      p.variants.length > 0 ? Math.min(...p.variants.map((v) => Number(v.price))) : Number(p.price),
  };
});
  const productImages = parseImages(product.images).map(formatImageUrl);

return {
  id: product.id,
  name: product.name,
  slug: product.slug,
  description: product.description,
  images: productImages,
  category: product.category,
  hasVariants,
  price: hasVariants ? null : Number(product.price),
  stock: hasVariants ? null : product.stock,
  displayPrice,
  taxRate: product.taxRate
    ? Number(product.taxRate)
    : product.category?.taxRate
    ? Number(product.category.taxRate)
    : null,
  variants,
  attributeOptions,
  avgRating,
  reviewCount,
  reviews: product.reviews.map((r) => ({
    rating: r.rating,
    comment: r.comment,
    images: parseImages(r.images).map(formatImageUrl),
    customerName: r.customer.name,
    createdAt: r.createdAt,
  })),
  relatedProducts,
};
  // Note: costPrice kabhi bhi is response mein nahi hai — business-sensitive field, customer ko kabhi expose nahi karna
}

export async function getWebsiteProductFiltersService(categorySlug?: string) {
  let categoryIds: string[] | undefined;

  if (categorySlug) {
    categoryIds = await getCategoryAndDescendantIds(categorySlug);
    if (categoryIds.length === 0) return {};
  }

  const variantAttributeValues = await prisma.variantAttributeValue.findMany({
    where: {
      variant: {
        product: {
          isActive: true,
          ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
        },
      },
    },
    select: {
      attributeValue: {
        select: { value: true, attribute: { select: { name: true } } },
      },
    },
    distinct: ["attributeValueId"],
  });

  const filters: Record<string, string[]> = {};
  for (const vav of variantAttributeValues) {
    const attrName = vav.attributeValue.attribute.name;
    const value = vav.attributeValue.value;
    if (!filters[attrName]) filters[attrName] = [];
    if (!filters[attrName].includes(value)) filters[attrName].push(value);
  }

  return filters;
}

// ==================== Bestsellers / Trending / Top-Rated ====================

async function getTopSellingProductIds(limit: number, sinceDate?: Date) {
  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      order: {
        status: "COMPLETED", // sirf actually completed orders count honge
        ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
      },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  return grouped.map((g) => g.productId);
}

async function getProductCardsByIds(productIds: string[]) {
  if (productIds.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      images: true,
      price: true,
      stock: true,
      createdAt: true,
      category: { select: { id: true, name: true, slug: true } },
      variants: { select: { price: true, stock: true } },
      reviews: { where: { isApproved: true }, select: { rating: true } },
    },
  });

  const cardMap = new Map(
    products.map((p) => {
      const hasVariants = p.variants.length > 0;
      const displayPrice = hasVariants
        ? Math.min(...p.variants.map((v) => Number(v.price)))
        : Number(p.price);
      const inStock = hasVariants ? p.variants.some((v) => v.stock > 0) : p.stock > 0;
      const reviewCount = p.reviews.length;
      const avgRating =
        reviewCount > 0
          ? Number((p.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1))
          : 0;

      const imgs = parseImages(p.images);
      const image = imgs.length > 0 ? formatImageUrl(imgs[0]) : null;

      return [
        p.id,
        {
          id: p.id,
          name: p.name,
          slug: p.slug,
          image, // ⬅️ ab yeh full URL dega
          displayPrice,
          hasVariants,
          inStock,
          avgRating,
          reviewCount,
          createdAt: p.createdAt,
          category: p.category,
        },
      ] as const;
    })
  );

  const productIds_ordered = productIds.map((id) => cardMap.get(id)).filter((p) => p !== undefined);
  return productIds_ordered;
}

export async function getBestsellersService(limit: number = 10) {
  const productIds = await getTopSellingProductIds(limit); // all-time, no date filter
  return getProductCardsByIds(productIds);
}

export async function getTrendingService(limit: number = 10) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const productIds = await getTopSellingProductIds(limit, sevenDaysAgo);
  return getProductCardsByIds(productIds);
}

export async function getTopRatedService(limit: number = 10, minReviews: number = 3) {
  const grouped = await prisma.review.groupBy({
    by: ["productId"],
    where: { isApproved: true },
    _avg: { rating: true },
    _count: { rating: true },
    having: { rating: { _count: { gte: minReviews } } },
    orderBy: { _avg: { rating: "desc" } },
    take: limit,
  });

  const productIds = grouped.map((g) => g.productId);
  return getProductCardsByIds(productIds); // rating-desc order already preserved
}