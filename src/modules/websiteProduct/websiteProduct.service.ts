import prisma from "../../config/db.js";
import { Prisma } from "@prisma/client";
import { formatImageUrl } from "../../utils/formatImageUrl.js";
import { resolveTaxBreakdown } from "../../utils/taxCalculator.js";
//import { formatImageUrl, formatImageUrls } from "../../utils/formatImageUrl";

//Helperbina variants wala product, YA kam se kam 1 active variant wala
const SELLABLE: Prisma.ProductWhereInput = {
  OR: [
    { variants: { none: {} } },
    { variants: { some: { isActive: true } } },
  ],
};

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

function computeDiscount(price: number, mrp: any) {
  const mrpNum = mrp ? Number(mrp) : null;
  if (!mrpNum || mrpNum <= price) {
    return { mrp: null, discountPercent: 0 };
  }
  return {
    mrp: mrpNum,
    discountPercent: Math.round(((mrpNum - price) / mrpNum) * 100),
  };
}

// displayPrice = sabse sasta variant/product — USI ka mrp/discount lena hai, kisi random variant ka nahi
function resolvePricing(
  basePrice: number,
  baseMrp: any,
  variants: { price: any; mrp: any }[],
) {
  if (variants.length === 0) {
    const { mrp, discountPercent } = computeDiscount(basePrice, baseMrp);
    return { displayPrice: basePrice, mrp, discountPercent };
  }

  const cheapest = variants.reduce(
    (min, v) => (Number(v.price) < Number(min.price) ? v : min),
    variants[0],
  );
  const displayPrice = Number(cheapest.price);
  const { mrp, discountPercent } = computeDiscount(displayPrice, cheapest.mrp);
  return { displayPrice, mrp, discountPercent };
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
  minDiscount?: number;
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
    minDiscount,
    attributes,
    sort = "newest",
    page = 1,
    limit = 20,
  } = query;

  const where: Prisma.ProductWhereInput = { isActive: true };
  const andFilters: Prisma.ProductWhereInput[] = [SELLABLE];

  if (category) {
    const categoryIds = await getCategoryAndDescendantIds(category);
    if (categoryIds.length === 0) {
      return { products: [], total: 0, page, limit };
    }
    where.categoryId = { in: categoryIds };
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
    ];
  }

 if (attributes && Object.keys(attributes).length > 0) {
  andFilters.push(
    ...Object.entries(attributes).map(([attrName, values]) => ({
      variants: {
        some: {
          isActive: true, // naya
          attributeValues: {
            some: {
              attributeValue: { attribute: { name: attrName }, value: { in: values } },
            },
          },
        },
      },
    })),
  );
}
where.AND = andFilters;

  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      images: true,
      price: true,
      mrp: true,
      stock: true,
      createdAt: true,
      category: { select: { id: true, name: true, slug: true } },
     variants: { where: { isActive: true }, select: { price: true, mrp: true, stock: true } },
      reviews: { where: { isApproved: true }, select: { rating: true } },
    },
  });

  let result = products.map((p) => {
    const hasVariants = p.variants.length > 0;
    const { displayPrice, mrp, discountPercent } = resolvePricing(Number(p.price), p.mrp, p.variants);
    const inStock = hasVariants
      ? p.variants.some((v) => v.stock > 0)
      : p.stock > 0;
    const reviewCount = p.reviews.length;
    const avgRating =
      reviewCount > 0
        ? Number(
            (
              p.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
            ).toFixed(1),
          )
        : 0;

    const imgs = parseImages(p.images);
    const image = imgs.length > 0 ? formatImageUrl(imgs[0]) : null;

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      image,
      displayPrice,
      mrp,
      discountPercent,
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

    if (minDiscount !== undefined) {
    result = result.filter((p) => p.discountPercent >= minDiscount);
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
const product = await prisma.product.findFirst({
  where: { slug, isActive: true, AND: [SELLABLE] },
  include: {
    category: { select: { id: true, name: true, slug: true, taxClassId: true } },
    variants: {
      where: { isActive: true }, // naya
      include: {
        attributeValues: { include: { attributeValue: { include: { attribute: true } } } },
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

  // const hasVariants = product.variants.length > 0;
  // const displayPrice = hasVariants
  //   ? Math.min(...product.variants.map((v) => Number(v.price)))
  //   : Number(product.price);
  const hasVariants = product.variants.length > 0;
  const { displayPrice, mrp, discountPercent } = resolvePricing(
    Number(product.price),
    product.mrp,
    product.variants.map((v) => ({ price: v.price, mrp: v.mrp })),
  );

  const reviewCount = product.reviews.length;
  const avgRating =
    reviewCount > 0
      ? Number(
          (
            product.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
          ).toFixed(1),
        )
      : 0;

  const variants = product.variants.map((v) => {
    const { mrp: variantMrp, discountPercent: variantDiscountPercent } =
      computeDiscount(Number(v.price), v.mrp);
    return {
      id: v.id,
      sku: v.sku,
      price: Number(v.price),
      mrp: variantMrp, 
      discountPercent: variantDiscountPercent,
      stock: v.stock,
      attributes: v.attributeValues.map((vav) => ({
        attributeName: vav.attributeValue.attribute.name,
        value: vav.attributeValue.value,
      })),
    };
  });

  const attributeOptions: Record<string, string[]> = {};
  for (const v of variants) {
    for (const attr of v.attributes) {
      if (!attributeOptions[attr.attributeName])
        attributeOptions[attr.attributeName] = [];
      if (!attributeOptions[attr.attributeName].includes(attr.value)) {
        attributeOptions[attr.attributeName].push(attr.value);
      }
    }
  }

  const relatedRaw = product.categoryId
    ? await prisma.product.findMany({
        where: {
          categoryId: product.categoryId,
          isActive: true,
          id: { not: product.id }, AND: [SELLABLE] },
        select: {
          id: true,
          name: true,
          slug: true,
          images: true,
          price: true,
          mrp: true,
       variants: { where: { isActive: true }, select: { price: true, mrp: true } },
        },
        take: 6,
      })
    : [];

  const relatedProducts = relatedRaw.map((p) => {
    const imgs = parseImages(p.images);
    const { displayPrice, mrp, discountPercent } = resolvePricing(
      Number(p.price),
      p.mrp,
      p.variants,
    );
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      image: imgs.length > 0 ? formatImageUrl(imgs[0]) : null,
      displayPrice,
      mrp,
      discountPercent,
    };
  });
  const productImages = parseImages(product.images).map(formatImageUrl);
  const storeSettings = await prisma.storeSettings.findFirst();
  const storeCountry = storeSettings?.country ?? "India";
  const storeState = storeSettings?.state ?? "";

  const taxClassId = product.taxClassId ?? product.category?.taxClassId ?? null;

  const { taxAmount: estimatedTaxPercent } = await resolveTaxBreakdown(
    prisma as unknown as Prisma.TransactionClient,
    taxClassId,
    storeCountry,
    storeState,
    storeCountry,
    storeState,
    100,
  );

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
    mrp,
    discountPercent,
    taxRate: estimatedTaxPercent > 0 ? estimatedTaxPercent : null,
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
        isActive: true,
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
  product: { isActive: true, AND: [SELLABLE] },
  order: { status: "COMPLETED", ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}) },
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
    where: { id: { in: productIds }, isActive: true,AND: [SELLABLE] },
    select: {
      id: true,
      name: true,
      slug: true,
      images: true,
      price: true,
      mrp: true,
      stock: true,
      createdAt: true,
      category: { select: { id: true, name: true, slug: true } },
     variants: { where: { isActive: true }, select: { price: true, mrp: true, stock: true } },
      reviews: { where: { isApproved: true }, select: { rating: true } },
    },
  });

  const cardMap = new Map(
    products.map((p) => {
      const hasVariants = p.variants.length > 0;
    const { displayPrice, mrp, discountPercent } = resolvePricing(Number(p.price), p.mrp, p.variants);
      const inStock = hasVariants
        ? p.variants.some((v) => v.stock > 0)
        : p.stock > 0;
      const reviewCount = p.reviews.length;
      const avgRating =
        reviewCount > 0
          ? Number(
              (
                p.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
              ).toFixed(1),
            )
          : 0;

      const imgs = parseImages(p.images);
      const image = imgs.length > 0 ? formatImageUrl(imgs[0]) : null;

      return [
        p.id,
        {
          id: p.id,
          name: p.name,
          slug: p.slug,
          image,
          displayPrice,
          mrp,
          discountPercent,
          hasVariants,
          inStock,
          avgRating,
          reviewCount,
          createdAt: p.createdAt,
          category: p.category,
        },
      ] as const;
    }),
  );

  const productIds_ordered = productIds
    .map((id) => cardMap.get(id))
    .filter((p) => p !== undefined);
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

export async function getTopRatedService(
  limit: number = 10,
  minReviews: number = 3,
) {
  const grouped = await prisma.review.groupBy({
    by: ["productId"],
  where: { isApproved: true, product: { isActive: true, AND: [SELLABLE] } },
    _avg: { rating: true },
    _count: { rating: true },
    having: { rating: { _count: { gte: minReviews } } },
    orderBy: { _avg: { rating: "desc" } },
    take: limit,
  });

  const productIds = grouped.map((g) => g.productId);
  return getProductCardsByIds(productIds); // rating-desc order already preserved
}

export async function getRecommendedProductsService(
  customerId: string | null,
  limit: number = 10,
) {
  // Guest ya bina history wale customer ke liye — bestseller fallback (cold-start problem ka standard solution)
  if (!customerId) {
    return getBestsellersService(limit);
  }

  // Step 1: Purchase history se categories nikaalo (sirf COMPLETED orders)
  const orderItems = await prisma.orderItem.findMany({
    where: { order: { customerId, status: "COMPLETED" } },
    select: { productId: true, product: { select: { categoryId: true } } },
  });

  // Step 2: Agar order history nahi hai, wishlist se try karo
  const wishlistItems =
    orderItems.length === 0
      ? await prisma.wishlistItem.findMany({
          where: { customerId },
          select: {
            productId: true,
            product: { select: { categoryId: true } },
          },
        })
      : [];

  const sourceItems = orderItems.length > 0 ? orderItems : wishlistItems;

  // Koi history hi nahi (naya customer) — bestseller fallback
  if (sourceItems.length === 0) {
    return getBestsellersService(limit);
  }

  // Category frequency count karo, top 3 categories nikaalo
  const categoryFreq = new Map<string, number>();
  const excludeProductIds = new Set<string>();

  for (const item of sourceItems) {
    excludeProductIds.add(item.productId); // jo already khareeda/wishlist kiya, dobara suggest mat karo
    const catId = item.product.categoryId;
    if (catId) categoryFreq.set(catId, (categoryFreq.get(catId) || 0) + 1);
  }

  const topCategoryIds = [...categoryFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([catId]) => catId);

  if (topCategoryIds.length === 0) {
    return getBestsellersService(limit);
  }

  const products = await prisma.product.findMany({
    where: {
      categoryId: { in: topCategoryIds },
      isActive: true,
      id: { notIn: [...excludeProductIds] },
      AND: [SELLABLE],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      images: true,
      price: true,
      mrp: true,
      stock: true,
      createdAt: true,
      category: { select: { id: true, name: true, slug: true } },
    variants: { where: { isActive: true }, select: { price: true, mrp: true, stock: true } },
      reviews: { where: { isApproved: true }, select: { rating: true } },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  // Category mein aur naye products nahi bache — bestseller fallback
  if (products.length === 0) {
    return getBestsellersService(limit);
  }

  return products.map((p) => {
    const hasVariants = p.variants.length > 0;
   const { displayPrice, mrp, discountPercent } = resolvePricing(Number(p.price), p.mrp, p.variants);
    const inStock = hasVariants
      ? p.variants.some((v) => v.stock > 0)
      : p.stock > 0;
    const reviewCount = p.reviews.length;
    const avgRating =
      reviewCount > 0
        ? Number(
            (
              p.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
            ).toFixed(1),
          )
        : 0;

    const imgs = parseImages(p.images);
    const image = imgs.length > 0 ? formatImageUrl(imgs[0]) : null;

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      image,
      displayPrice,
      mrp,
      discountPercent,
      hasVariants,
      inStock,
      avgRating,
      reviewCount,
      createdAt: p.createdAt,
      category: p.category,
    };
  });
}

// ==================== Category "Upto X% Off" Deals ====================

interface CategoryDeal {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  maxDiscount: number;
}

export async function getCategoryDealsService(): Promise<CategoryDeal[]> {
  const deals = await prisma.$queryRaw<CategoryDeal[]>`
    SELECT c.id as categoryId, c.name as categoryName, c.slug as categorySlug,
           MAX(discounts.discount) as maxDiscount
    FROM (
      -- bina variants wale products: product-level mrp/price
      SELECT p.categoryId, ROUND(((p.mrp - p.price) / p.mrp) * 100) as discount
      FROM products p
      WHERE p.isActive = true
        AND p.mrp IS NOT NULL AND p.mrp > p.price
        AND p.categoryId IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM product_variants v WHERE v.productId = p.id
        )

      UNION ALL

      -- variants wale products: sirf ACTIVE variants ka discount
      SELECT p.categoryId, ROUND(((pv.mrp - pv.price) / pv.mrp) * 100) as discount
      FROM product_variants pv
      JOIN products p ON pv.productId = p.id
      WHERE p.isActive = true
        AND pv.isActive = true
        AND pv.mrp IS NOT NULL AND pv.mrp > pv.price
        AND p.categoryId IS NOT NULL
    ) as discounts
    JOIN categories c ON c.id = discounts.categoryId
    GROUP BY c.id, c.name, c.slug
    ORDER BY maxDiscount DESC
  `;

  // MySQL se BigInt/Decimal kabhi-kabhi string/BigInt type mein aata hai raw query se — Number() se normalize kar rahe hain
  return deals.map((d) => ({
    ...d,
    maxDiscount: Number(d.maxDiscount),
  }));
}
