import prisma from "../../config/db.js";
import { Prisma } from "@prisma/client";
import { formatImageUrl, formatImageUrls } from "../../utils/formatImageUrl.js";

interface CreateProductInput {
  name: string;
  slug?: string;
  description?: string;
  sku: string;
  price: number;
  costPrice?: number;
 taxClassId?: string;
  categoryId?: string;
  stock?: number;
  lowStockThreshold?: number;
  images: string[];
}

interface UpdateProductInput {
  name?: string;
  slug?: string;
  description?: string;
  sku?: string;
  price?: number;
  costPrice?: number;
 taxClassId?: string;
  categoryId?: string;
  stock?: number;
  lowStockThreshold?: number;
  images?: string[];
  isActive?: boolean;
}

interface ProductListQuery {
  page?: number;
  limit?: number;
  categoryId?: string;
  search?: string;
  includeInactive?: boolean;
}

interface AttributeInput {
  attributeId: string;
  value: string;
}

interface CreateVariantInput {
  name: string;
  sku: string;
  price: number;
  stock?: number;
  attributes: AttributeInput[];
}

interface AttributeGroup {
  attributeId: string;
  values: string[];
}

interface GenerateVariantsInput {
  attributeGroups: AttributeGroup[];
  basePrice: number;
  baseStock?: number;
}

interface UpdateVariantInput {
  name?: string;
  price?: number;
  stock?: number;
  images?: string[];
}


function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// function withFullImageUrls<T extends { images: string[] }>(product: T) {
//   return { ...product, images: formatImageUrls(product.images) };
// }

function withFullImageUrls<T extends { images: string | null }>(product: T) {
  const imagesArray: string[] = product.images ? JSON.parse(product.images) : [];
  return { ...product, images: formatImageUrls(imagesArray) };
}

// ==================== PRODUCT SERVICES ====================

export async function createProductService(data: CreateProductInput) {
  const slug = generateSlug(data.slug || data.name);

  const existingSku = await prisma.product.findUnique({ where: { sku: data.sku } });
  if (existingSku) {
    throw new Error("A product with this SKU already exists");
  }

  const existingSlug = await prisma.product.findUnique({ where: { slug } });
  if (existingSlug) {
    throw new Error("A product with this slug already exists");
  }

const product = await prisma.product.create({
  data: {
    name: data.name,
    slug,
    description: data.description,
    sku: data.sku,
    price: data.price,
    costPrice: data.costPrice,
  taxClassId: data.taxClassId,
    categoryId: data.categoryId,
    stock: data.stock ?? 0,
    lowStockThreshold: data.lowStockThreshold ?? 5,
    images: JSON.stringify(data.images ?? []),
  },
});

return withFullImageUrls(product);
}

export async function getAllProductsService(query: ProductListQuery) {
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit = query.limit && query.limit > 0 ? query.limit : 20;
  const skip = (page - 1) * limit;

  const where: Prisma.ProductWhereInput = {};

  if (!query.includeInactive) {
    where.isActive = true;
  }

  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  if (query.search) {
    where.name = { contains: query.search};
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.count({ where }),
  ]);

return {
  products: products.map(withFullImageUrls),
  pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
};
}

export async function getProductByIdService(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      variants: {
        include: {
          attributeValues: {
            include: { attributeValue: { include: { attribute: true } } },
          },
        },
      },
      reviews: {
        include: {
          customer: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  const formatted = withFullImageUrls(product);

  return {
    ...formatted,
    category: product.category
      ? { ...product.category, image: product.category.image ? formatImageUrl(product.category.image) : null }
      : null,
    variants: product.variants.map((v) => ({
      ...v,
      images: formatImageUrls(JSON.parse(v.images || "[]")),
    })),
    reviews: product.reviews.map((r) => {
      const date = new Date(r.createdAt);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();

      return {
        ...r,
        images: formatImageUrls(JSON.parse(r.images || "[]")),
        createdAtFormatted: `${day}-${month}-${year}`,
      };
    }),
  };
}

export async function updateProductService(id: string, data: UpdateProductInput) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Product not found");
  }

  if (data.sku && data.sku !== existing.sku) {
    const skuTaken = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (skuTaken) {
      throw new Error("A product with this SKU already exists");
    }
  }

  let slug = existing.slug;
  if (data.slug) {
    slug = generateSlug(data.slug);
    const slugTaken = await prisma.product.findFirst({ where: { slug, NOT: { id } } });
    if (slugTaken) {
      throw new Error("A product with this slug already exists");
    }
  }

  // images ko alag nikaal lo, baaki sab spread kar do
  const { images, ...rest } = data;

  const updateData: Prisma.ProductUncheckedUpdateInput = {
    ...rest,
    slug,
    ...(images ? { images: JSON.stringify(images) } : {}),
  };

  const updated = await prisma.product.update({ where: { id }, data: updateData });
  return withFullImageUrls(updated);
}

export async function deleteProductService(id: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Product not found");
  }

  return prisma.product.update({ where: { id }, data: { isActive: false } });
}

// ==================== VARIANT SERVICES ====================

export async function createVariantService(productId: string, data: CreateVariantInput) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new Error("Product not found");
  }

  const existingSku = await prisma.productVariant.findUnique({ where: { sku: data.sku } });
  if (existingSku) {
    throw new Error("A variant with this SKU already exists");
  }

  const attributeValueIds: string[] = [];

  for (const attr of data.attributes) {
    const attribute = await prisma.attribute.findUnique({ where: { id: attr.attributeId } });
    if (!attribute) {
      throw new Error(`Attribute not found: ${attr.attributeId}`);
    }

    let attributeValue = await prisma.attributeValue.findFirst({
      where: { attributeId: attr.attributeId, value: { equals: attr.value } },
    });

    if (!attributeValue) {
      attributeValue = await prisma.attributeValue.create({
        data: { attributeId: attr.attributeId, value: attr.value },
      });
    }

    attributeValueIds.push(attributeValue.id);
  }

  const variant = await prisma.productVariant.create({
    data: {
      productId,
      name: data.name,
      sku: data.sku,
      price: data.price,
      stock: data.stock ?? 0,
      images: JSON.stringify([]),
      attributeValues: {
        create: attributeValueIds.map((attributeValueId) => ({ attributeValueId })),
      },
    },
    include: {
      attributeValues: { include: { attributeValue: { include: { attribute: true } } } },
    },
  });

  return { ...variant, images: formatImageUrls(JSON.parse(variant.images || "[]")) };
}

export async function getVariantsByProductService(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new Error("Product not found");
  }

  const variants = await prisma.productVariant.findMany({
    where: { productId },
    include: { attributeValues: { include: { attributeValue: { include: { attribute: true } } } } },
  });

  return variants.map((v) => ({
    ...v,
    images: formatImageUrls(JSON.parse(v.images || "[]")),
  }));
}

export async function deleteVariantService(variantId: string) {
  const existing = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!existing) {
    throw new Error("Variant not found");
  }

  return prisma.productVariant.delete({ where: { id: variantId } });
}

export async function updateVariantService(variantId: string, data: UpdateVariantInput) {
  const existing = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!existing) {
    throw new Error("Variant not found");
  }

  const variant = await prisma.productVariant.update({
    where: { id: variantId },
    data: {
      name: data.name,
      price: data.price,
      stock: data.stock,
      images: data.images ? JSON.stringify(data.images) : undefined,
    },
    include: {
      attributeValues: { include: { attributeValue: { include: { attribute: true } } } },
    },
  });

  return { ...variant, images: formatImageUrls(JSON.parse(variant.images || "[]")) };
}
// Cartesian product helper — [[A,B],[X,Y]] → [[A,X],[A,Y],[B,X],[B,Y]]
function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (acc, curr) => acc.flatMap((combo) => curr.map((item) => [...combo, item])),
    [[]]
  );
}

export async function generateVariantsService(productId: string, data: GenerateVariantsInput) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new Error("Product not found");
  }

  if (!data.attributeGroups || data.attributeGroups.length === 0) {
    throw new Error("At least one attribute group is required");
  }

  // Har attribute group ke liye find-or-create attribute values, IDs collect karo
  const resolvedGroups: { attributeId: string; label: string; valueId: string }[][] = [];

  for (const group of data.attributeGroups) {
    const attribute = await prisma.attribute.findUnique({ where: { id: group.attributeId } });
    if (!attribute) {
      throw new Error(`Attribute not found: ${group.attributeId}`);
    }

    const groupItems = [];
    for (const val of group.values) {
      let attributeValue = await prisma.attributeValue.findFirst({
        where: { attributeId: group.attributeId, value: { equals: val} },
      });

      if (!attributeValue) {
        attributeValue = await prisma.attributeValue.create({
          data: { attributeId: group.attributeId, value: val },
        });
      }

      groupItems.push({ attributeId: group.attributeId, label: val, valueId: attributeValue.id });
    }

    resolvedGroups.push(groupItems);
  }

  // Saare combinations nikalo (Cartesian product)
  const combinations = cartesianProduct(resolvedGroups);

  const createdVariants = [];

  for (const combo of combinations) {
    const variantName = combo.map((c) => c.label).join(" - ");
    const skuSuffix = combo.map((c) => c.label.toUpperCase().replace(/\s+/g, "")).join("-");
    const sku = `${product.sku}-${skuSuffix}`;

    const existingSku = await prisma.productVariant.findUnique({ where: { sku } });
    if (existingSku) {
      continue; // pehle se bana hua combination skip karo, duplicate error na aaye
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        name: variantName,
        sku,
        price: data.basePrice,
        stock: data.baseStock ?? 0,
        images: JSON.stringify([]),
        attributeValues: {
          create: combo.map((c) => ({ attributeValueId: c.valueId })),
        },
      },
      include: {
        attributeValues: { include: { attributeValue: { include: { attribute: true } } } },
      },
    });

    createdVariants.push({ ...variant, images: formatImageUrls(JSON.parse(variant.images || "[]")) });
  }

  return createdVariants;
}