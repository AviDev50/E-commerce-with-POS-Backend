import prisma from "../../config/db.js";
import { formatImageUrl } from "../../utils/formatImageUrl.js";

interface CreateCategoryInput {
  name: string;
  slug?: string;
  parentId?: string;
 taxClassId?: string;
  image?: string;
}

interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  parentId?: string;
 taxClassId?: string;
  image?: string;
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

  const category = await prisma.category.create({
    data: {
      name: data.name,
      slug,
      parentId: data.parentId,
      taxClassId: data.taxClassId,
      image: data.image,
    },
  });

  return { ...category, image: category.image ? formatImageUrl(category.image) : null };
}

export async function getAllCategoriesService(topLevelOnly?: boolean) {
  const categories = await prisma.category.findMany({
    where: topLevelOnly ? { parentId: null } : {},
    include: { parent: true, children: true, _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });

  return categories.map((cat) => ({
    ...cat,
    image: cat.image ? formatImageUrl(cat.image) : null,
    children: cat.children.map((child) => ({
      ...child,
      image: child.image ? formatImageUrl(child.image) : null,
    })),
    parent: cat.parent
      ? { ...cat.parent, image: cat.parent.image ? formatImageUrl(cat.parent.image) : null }
      : null,
  }));
}

export async function getCategoryByIdService(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { parent: true, children: true, _count: { select: { products: true } } },
  });

  if (!category) {
    throw new Error("Category not found");
  }

  return {
    ...category,
    image: category.image ? formatImageUrl(category.image) : null,
    children: category.children.map((child) => ({
      ...child,
      image: child.image ? formatImageUrl(child.image) : null,
    })),
    parent: category.parent
      ? { ...category.parent, image: category.parent.image ? formatImageUrl(category.parent.image) : null }
      : null,
  };
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

  const updated = await prisma.category.update({
    where: { id },
    data: { ...data, slug },
  });

  return { ...updated, image: updated.image ? formatImageUrl(updated.image) : null };
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


