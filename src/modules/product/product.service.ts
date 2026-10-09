import prisma from "../../config/db.js";
import { Prisma } from "@prisma/client";
import { formatImageUrl, formatImageUrls } from "../../utils/formatImageUrl.js";

interface CreateProductInput {
  name: string;
  slug?: string;
  description?: string;
  sku: string;
  price: number;
  mrp?: number;
  costPrice?: number;
  taxClassId?: string;
  categoryId?: string;
  stock?: number;
  lowStockThreshold?: number;
  images: string[];
  isReturnable?: boolean; // admin explicit set kare to override, warna undefined = category-default
  returnPolicyText?: string;
}

interface UpdateProductInput {
  name?: string;
  slug?: string;
  description?: string;
  sku?: string;
  price?: number;
  mrp?: number;
  costPrice?: number;
  taxClassId?: string;
  categoryId?: string;
  stock?: number;
  lowStockThreshold?: number;
  images?: string[];
  isActive?: boolean;
  isReturnable?: boolean;
  returnPolicyText?: string;
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
  mrp?: number;
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
  baseMrp?: number;
  baseStock?: number;
}

interface UpdateVariantInput {
  name?: string;
  price?: number;
  mrp?: number;
  stock?: number;
  images?: string[];
  isActive?: boolean;
}

function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function withFullImageUrls<T extends { images: string | null }>(product: T) {
  let imagesArray: string[] = [];
  if (product.images) {
    try {
      const parsed = JSON.parse(product.images);
      imagesArray = Array.isArray(parsed) ? parsed : [];
    } catch {
      imagesArray = []; // corrupted data — crash karne ki jagah empty images dikhao
    }
  }
  return { ...product, images: formatImageUrls(imagesArray) };
}

// ==================== PRODUCT SERVICES ====================

export async function createProductService(data: CreateProductInput) {
  const slug = generateSlug(data.slug || data.name);

  const existingSku = await prisma.product.findUnique({
    where: { sku: data.sku },
  });
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
      mrp: data.mrp,
      costPrice: data.costPrice,
      taxClassId: data.taxClassId,
      categoryId: data.categoryId,
      stock: data.stock ?? 0,
      lowStockThreshold: data.lowStockThreshold ?? 5,
      images: JSON.stringify(data.images ?? []),
      isReturnable: data.isReturnable, // explicit diya to wahi, warna null (= category-default resolve hoga read-time pe)
      returnPolicyText: data.returnPolicyText,
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
    where.name = { contains: query.search };
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
    products: products.map((p) => ({
      ...withFullImageUrls(p),
      // Resolution: product-level explicit setting > category default > true (fallback)
      // getProductByIdService jaisa hi logic — listing pe bhi badge dikhane ke liye
      isReturnable: p.isReturnable ?? p.category?.isReturnable ?? true,
      returnPolicyText:
        p.returnPolicyText ?? p.category?.returnPolicyText ?? null,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getProductByIdService(id: string, includeInactive = false) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      variants: {
        where: includeInactive ? undefined : { isActive: true },
        include: {
          attributeValues: {
            include: { attributeValue: { include: { attribute: true } } },
          },
        },
      },
      reviews: { include: { customer: { select: { id: true, name: true } } } },
    },
  });

  // inactive product public ko direct URL se bhi nahi dikhna chahiye
  if (!product || (!product.isActive && !includeInactive)) {
    throw new Error("Product not found");
  }

  const formatted = withFullImageUrls(product);

  // Resolution: product-level explicit setting > category default > true (fallback)
  const resolvedIsReturnable =
    product.isReturnable ?? product.category?.isReturnable ?? true;
  const resolvedReturnPolicyText =
    product.returnPolicyText ?? product.category?.returnPolicyText ?? null;

  return {
    ...formatted,
    isReturnable: resolvedIsReturnable,
    returnPolicyText: resolvedReturnPolicyText, // raw product.isReturnable (jo null bhi ho sakta hai) ko yahan overwrite kar rahe hain resolved value se
    category: product.category
      ? {
          ...product.category,
          image: product.category.image
            ? formatImageUrl(product.category.image)
            : null,
        }
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

export async function updateProductService(
  id: string,
  data: UpdateProductInput,
) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Product not found");
  }

  if (data.sku && data.sku !== existing.sku) {
    const skuTaken = await prisma.product.findUnique({
      where: { sku: data.sku },
    });
    if (skuTaken) {
      throw new Error("A product with this SKU already exists");
    }
  }

  let slug = existing.slug;
  if (data.slug) {
    slug = generateSlug(data.slug);
    const slugTaken = await prisma.product.findFirst({
      where: { slug, NOT: { id } },
    });
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

  const updated = await prisma.product.update({
    where: { id },
    data: updateData,
  });
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

export async function createVariantService(
  productId: string,
  data: CreateVariantInput,
) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new Error("Product not found");
  }

  const existingSku = await prisma.productVariant.findUnique({
    where: { sku: data.sku },
  });
  if (existingSku) {
    throw new Error("A variant with this SKU already exists");
  }

  const attributeValueIds: string[] = [];

  for (const attr of data.attributes) {
    const attribute = await prisma.attribute.findUnique({
      where: { id: attr.attributeId },
    });
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
      mrp: data.mrp,
      stock: data.stock ?? 0,
      images: JSON.stringify([]),
      attributeValues: {
        create: attributeValueIds.map((attributeValueId) => ({
          attributeValueId,
        })),
      },
    },
    include: {
      attributeValues: {
        include: { attributeValue: { include: { attribute: true } } },
      },
    },
  });

  return {
    ...variant,
    images: formatImageUrls(JSON.parse(variant.images || "[]")),
  };
}

export async function getVariantsByProductService(productId: string, includeInactive = false) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || (!product.isActive && !includeInactive)) {
    throw new Error("Product not found");
  }

  const variants = await prisma.productVariant.findMany({
    where: { productId, ...(includeInactive ? {} : { isActive: true }) },
    include: {
      attributeValues: {
        include: { attributeValue: { include: { attribute: true } } },
      },
    },
  });

  return variants.map((v) => ({
    ...v,
    images: formatImageUrls(JSON.parse(v.images || "[]")),
  }));
}

export async function deleteVariantService(variantId: string) {
  const existing = await prisma.productVariant.findUnique({
    where: { id: variantId },
  });
  if (!existing) {
    throw new Error("Variant not found");
  }

  return prisma.productVariant.update({
    where: { id: variantId },
    data: { isActive: false },
  });
}

export async function updateVariantService(
  variantId: string,
  data: UpdateVariantInput,
) {
  const existing = await prisma.productVariant.findUnique({
    where: { id: variantId },
  });
  if (!existing) {
    throw new Error("Variant not found");
  }

  const variant = await prisma.productVariant.update({
    where: { id: variantId },
    data: {
      name: data.name,
      price: data.price,
      mrp: data.mrp,
      stock: data.stock,
      images: data.images ? JSON.stringify(data.images) : undefined,
      isActive: data.isActive,
    },
    include: {
      attributeValues: {
        include: { attributeValue: { include: { attribute: true } } },
      },
    },
  });

  return {
    ...variant,
    images: formatImageUrls(JSON.parse(variant.images || "[]")),
  };
}

// Cartesian product helper — [[A,B],[X,Y]] → [[A,X],[A,Y],[B,X],[B,Y]]
function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (acc, curr) => acc.flatMap((combo) => curr.map((item) => [...combo, item])),
    [[]],
  );
}

export async function generateVariantsService(
  productId: string,
  data: GenerateVariantsInput,
) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new Error("Product not found");
  }

  if (!data.attributeGroups || data.attributeGroups.length === 0) {
    throw new Error("At least one attribute group is required");
  }

  // Har attribute group ke liye find-or-create attribute values, IDs collect karo
  const resolvedGroups: {
    attributeId: string;
    label: string;
    valueId: string;
  }[][] = [];

  for (const group of data.attributeGroups) {
    const attribute = await prisma.attribute.findUnique({
      where: { id: group.attributeId },
    });
    if (!attribute) {
      throw new Error(`Attribute not found: ${group.attributeId}`);
    }

    const groupItems = [];
    for (const val of group.values) {
      let attributeValue = await prisma.attributeValue.findFirst({
        where: { attributeId: group.attributeId, value: { equals: val } },
      });

      if (!attributeValue) {
        attributeValue = await prisma.attributeValue.create({
          data: { attributeId: group.attributeId, value: val },
        });
      }

      groupItems.push({
        attributeId: group.attributeId,
        label: val,
        valueId: attributeValue.id,
      });
    }

    resolvedGroups.push(groupItems);
  }

  // Saare combinations nikalo (Cartesian product)
  const combinations = cartesianProduct(resolvedGroups);

  const createdVariants = [];

  for (const combo of combinations) {
    const variantName = combo.map((c) => c.label).join(" - ");
    const skuSuffix = combo
      .map((c) => c.label.toUpperCase().replace(/\s+/g, ""))
      .join("-");
    const sku = `${product.sku}-${skuSuffix}`;

    const existingSku = await prisma.productVariant.findUnique({
      where: { sku },
    });
    if (existingSku) {
      continue; // pehle se bana hua combination skip karo, duplicate error na aaye
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        name: variantName,
        sku,
        price: data.basePrice,
        mrp: data.baseMrp,
        stock: data.baseStock ?? 0,
        images: JSON.stringify([]),
        attributeValues: {
          create: combo.map((c) => ({ attributeValueId: c.valueId })),
        },
      },
      include: {
        attributeValues: {
          include: { attributeValue: { include: { attribute: true } } },
        },
      },
    });

    createdVariants.push({
      ...variant,
      images: formatImageUrls(JSON.parse(variant.images || "[]")),
    });
  }

  return createdVariants;
}

// ==================== POS BILLING SEARCH ====================
// Cashier/Admin dono POS Panel pe isse use karenge billing counter pe.
// costPrice yahan kabhi select nahi hota — Cashier ko margin/cost dikhna nahi chahiye.

interface PosProductSearchQuery {
  search?: string; // name YA sku dono pe match karega
  page?: number;
  limit?: number;
}

export async function getProductsForPosService(query: PosProductSearchQuery) {
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit = query.limit && query.limit > 0 ? query.limit : 20;

  const where: Prisma.ProductWhereInput = { isActive: true };

  // name OR sku dono pe search — cashier chahe naam type kare ya SKU
  if (query.search) {
    where.OR = [
      { name: { contains: query.search } },
      { sku: { contains: query.search } },
    ];
  }

  // costPrice explicitly select nahi kiya — safe by construction, filter se nahi, design se
  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      stock: true,
      images: true,
      _count: { select: { variants: true } },
      variants: {
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          stock: true,
          images: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // in-memory: hasVariants + inStock resolve karo (websiteProduct module jaisa hi pattern)
  const withStockInfo = products.map((p) => {
    const hasVariants = p._count.variants > 0;
    const inStock = hasVariants
      ? p.variants.some((v) => v.stock > 0)
      : p.stock > 0;

    const imgs: string[] = p.images ? JSON.parse(p.images) : [];

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: Number(p.price),
      stock: p.stock,
      image: imgs.length > 0 ? formatImageUrl(imgs[0]) : null,
      hasVariants,
      inStock,
      variants: p.variants.map((v) => {
        const vImgs: string[] = v.images ? JSON.parse(v.images) : [];
        return {
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: Number(v.price),
          stock: v.stock,
          inStock: v.stock > 0,
          image: vImgs.length > 0 ? formatImageUrl(vImgs[0]) : null,
        };
      }),
    };
  });

  // out-of-stock products billing list se hata do — cashier ko select karne ka mauka hi na mile
  const inStockOnly = withStockInfo.filter((p) => p.inStock);

  const total = inStockOnly.length;
  const start = (page - 1) * limit;
  const paginated = inStockOnly.slice(start, start + limit);

  return {
    products: paginated,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function setProductStatusService(id: string, isActive: boolean) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new Error("Product not found");

  // variants ko touch nahi karte — reactivate par purani states wapas milengi
  return prisma.product.update({
    where: { id },
    data: { isActive },
    select: { id: true, name: true, isActive: true },
  });
}

export async function setVariantStatusService(variantId: string, isActive: boolean) {
  const existing = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!existing) throw new Error("Variant not found");

  const variant = await prisma.productVariant.update({
    where: { id: variantId },
    data: { isActive },
    select: { id: true, name: true, isActive: true, productId: true },
  });

  let warning: string | undefined;
  if (!isActive) {
    const activeCount = await prisma.productVariant.count({
      where: { productId: existing.productId, isActive: true },
    });
    if (activeCount === 0) {
      warning = "This was the last active variant — the product has no purchasable variants now";
    }
  }

  return { variant, warning };
}


// getProductByIdService we start from here