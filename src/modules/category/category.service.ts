import prisma from "../../config/db.js";

interface CreateCategoryInput {
  name: string;
  slug?: string;
  parentId?: string;
  taxRate?: number;
}

interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  parentId?: string;
  taxRate?: number;
}

function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createCategoryService(data: CreateCategoryInput) {
  const slug = generateSlug(data.slug || data.name);

  const existingSlug = await prisma.category.findUnique({ where: { slug } });
  if (existingSlug) {
    throw new Error("A category with this slug already exists");
  }

  if (data.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
    if (!parent) {
      throw new Error("Parent category not found");
    }
  }

  return prisma.category.create({
    data: {
      name: data.name,
      slug,
      parentId: data.parentId,
      taxRate: data.taxRate,
    },
  });
}

export async function getAllCategoriesService() {
  return prisma.category.findMany({
    include: {
      parent: true,
      children: true,
      _count: { select: { products: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getCategoryByIdService(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      parent: true,
      children: true,
      _count: { select: { products: true } },
    },
  });

  if (!category) {
    throw new Error("Category not found");
  }

  return category;
}

export async function updateCategoryService(id: string, data: UpdateCategoryInput) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Category not found");
  }

  let slug = existing.slug;
  if (data.slug || data.name) {
    slug = generateSlug(data.slug || data.name || existing.name);
    const slugTaken = await prisma.category.findFirst({ where: { slug, NOT: { id } } });
    if (slugTaken) {
      throw new Error("A category with this slug already exists");
    }
  }

  if (data.parentId) {
    if (data.parentId === id) {
      throw new Error("A category cannot be its own parent");
    }
    const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
    if (!parent) {
      throw new Error("Parent category not found");
    }
  }

  return prisma.category.update({
    where: { id },
    data: { ...data, slug },
  });
}

export async function deleteCategoryService(id: string) {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } },
  });

  if (!existing) {
    throw new Error("Category not found");
  }

  if (existing._count.products > 0) {
    throw new Error("Cannot delete category — products are still assigned to it");
  }

  if (existing._count.children > 0) {
    throw new Error("Cannot delete category — it has subcategories");
  }

  return prisma.category.delete({ where: { id } });
}