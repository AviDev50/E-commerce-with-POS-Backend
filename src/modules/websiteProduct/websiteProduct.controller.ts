import { Request, Response } from "express";
import * as websiteProductService from "./websiteProduct.service.js";

const RESERVED_QUERY_KEYS = [
  "category",
  "search",
  "minPrice",
  "maxPrice",
   "minDiscount",
  "sort",
  "page",
  "limit",
];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function getAllWebsiteProducts(req: Request, res: Response) {
  try {
    const { category, search, minPrice, maxPrice, minDiscount, sort, page, limit } =
      req.query;

    // Baaki query params (color=Red,Blue, size=M) attribute filters maane jaayenge
    const attributes: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (RESERVED_QUERY_KEYS.includes(key)) continue;
      attributes[capitalize(key)] = String(value).split(",");
    }

    const result = await websiteProductService.getAllWebsiteProductsService({
      category: category as string | undefined,
      search: search as string | undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      minDiscount: minDiscount ? Number(minDiscount) : undefined,
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
      sort: sort as any,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    return res.status(200).json({ data: result });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getWebsiteProductBySlug(req: Request, res: Response) {
  try {
    const slug = req.params.slug as string;
    const product =
      await websiteProductService.getWebsiteProductBySlugService(slug);
    return res.status(200).json({ data: product });
  } catch (error: any) {
    return res.status(404).json({ message: error.message });
  }
}

export async function getWebsiteProductFilters(req: Request, res: Response) {
  try {
    const category = req.query.category as string | undefined;
    const filters =
      await websiteProductService.getWebsiteProductFiltersService(category);
    return res.status(200).json({ data: filters });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getBestsellers(req: Request, res: Response) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const products = await websiteProductService.getBestsellersService(limit);
    return res.status(200).json({ data: products });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getTrending(req: Request, res: Response) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const products = await websiteProductService.getTrendingService(limit);
    return res.status(200).json({ data: products });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getTopRated(req: Request, res: Response) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const products = await websiteProductService.getTopRatedService(limit);
    return res.status(200).json({ data: products });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getRecommendedProducts(req: Request, res: Response) {
  try {
    const customerId = req.customer?.id || null; // ⬅️ ab bina cast ke, jaisa aapka type augmentation hai
    const limit = req.query.limit ? Number(req.query.limit) : 10;

    const products = await websiteProductService.getRecommendedProductsService(
      customerId,
      limit,
    );
    return res.status(200).json({ data: products });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getCategoryDeals(_req: Request, res: Response) {
  try {
    const deals = await websiteProductService.getCategoryDealsService();
    return res.status(200).json({ data: deals });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
