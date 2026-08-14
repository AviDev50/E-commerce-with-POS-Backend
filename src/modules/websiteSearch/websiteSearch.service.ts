import prisma from "../../config/db.js";
import { formatImageUrl } from "../../utils/formatImageUrl.js";

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

export async function getSearchSuggestionsService(
  query: string,
  limit: number = 8,
) {
  if (!query?.trim() || query.trim().length < 2) {
    // 1-character search bahut zyada noise/results dega, kam se kam 2 characters chahiye
    return { products: [], categories: [] };
  }

  const searchTerm = query.trim();

  // Halka product query — variants/reviews join nahi, sirf jo dropdown mein chahiye
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      name: { contains: searchTerm },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      images: true,
      price: true,
    },
    take: limit,
    orderBy: { name: "asc" },
  });

  // Matching categories bhi suggest karo (Flipkart jaisa "in Skincare" suggestion)
  const categories = await prisma.category.findMany({
    where: { name: { contains: searchTerm } },
    select: { id: true, name: true, slug: true },
    take: 3,
  });

  const mappedProducts = products.map((p) => {
    const imgs = parseImages(p.images);
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      image: imgs.length > 0 ? formatImageUrl(imgs[0]) : null,
      price: Number(p.price), // note: variant products ka min price nahi nikaala — suggestion hai, exact price detail page pe milega
    };
  });

  return { products: mappedProducts, categories };
}
