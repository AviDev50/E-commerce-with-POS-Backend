import { Request, Response } from "express";
import * as productService from "./product.service.js";

// ==================== PRODUCT CONTROLLERS ====================

export async function createProduct(req: Request, res: Response) {
  try {
    const { name, slug, description, sku, price, costPrice, taxClassId, categoryId, stock, lowStockThreshold } = req.body;

    if (!name || !sku || !price) {
      return res.status(400).json({ message: "name, sku, and price are required" });
    }

    const files = (req.files as Express.Multer.File[]) || [];
    const images = files.map((file) => `/uploads/${file.filename}`);

    const product = await productService.createProductService({
      name,
      slug,
      description,
      sku,
      price: Number(price),
      costPrice: costPrice ? Number(costPrice) : undefined,
     taxClassId,
      categoryId,
      stock: stock ? Number(stock) : undefined,
      lowStockThreshold: lowStockThreshold ? Number(lowStockThreshold) : undefined,
      images,
    });

    return res.status(201).json({ message: "Product created", data: product });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function getAllProducts(req: Request, res: Response) {
  try {
    const { page, limit, categoryId, search, includeInactive } = req.query;

    const canSeeInactive =
      includeInactive === "true" &&
      req.user &&
      (req.user.role === "ADMIN" || req.user.role === "MANAGER");

    const result = await productService.getAllProductsService({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      categoryId: categoryId as string | undefined,
      search: search as string | undefined,
      includeInactive: Boolean(canSeeInactive),
    });

    return res.status(200).json({ data: result.products, pagination: result.pagination });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getProductById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const product = await productService.getProductByIdService(id);
    return res.status(200).json({ data: product });
  } catch (error: any) {
    return res.status(404).json({ message: error.message });
  }
}

export async function updateProduct(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { name, slug, description, sku, price, costPrice, taxClassId, categoryId, stock, lowStockThreshold, isActive } = req.body;

    const files = (req.files as Express.Multer.File[]) || [];
    const images = files.length > 0 ? files.map((file) => `/uploads/${file.filename}`) : undefined;

    const product = await productService.updateProductService(id, {
      name,
      slug,
      description,
      sku,
      price: price ? Number(price) : undefined,
      costPrice: costPrice ? Number(costPrice) : undefined,
     taxClassId,
      categoryId,
      stock: stock ? Number(stock) : undefined,
      lowStockThreshold: lowStockThreshold ? Number(lowStockThreshold) : undefined,
      images,
      isActive: isActive !== undefined ? isActive === "true" || isActive === true : undefined,
    });

    return res.status(200).json({ message: "Product updated", data: product });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function deleteProduct(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    await productService.deleteProductService(id);
    return res.status(200).json({ message: "Product deactivated" });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

// ==================== VARIANT CONTROLLERS ====================

export async function createVariant(req: Request, res: Response) {
  try {
    const productId = req.params.id as string;
    const { name, sku, price, stock, attributes } = req.body;

    if (!name || !sku || !price || !attributes) {
      return res.status(400).json({ message: "name, sku, price, and attributes are required" });
    }

    const variant = await productService.createVariantService(productId, {
      name,
      sku,
      price: Number(price),
      stock: stock ? Number(stock) : undefined,
      attributes,
    });

    return res.status(201).json({ message: "Variant created", data: variant });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function getVariantsByProduct(req: Request, res: Response) {
  try {
    const productId = req.params.id as string;
    const variants = await productService.getVariantsByProductService(productId);
    return res.status(200).json({ data: variants });
  } catch (error: any) {
    return res.status(404).json({ message: error.message });
  }
}

export async function deleteVariant(req: Request, res: Response) {
  try {
    const variantId = req.params.variantId as string;
    await productService.deleteVariantService(variantId);
    return res.status(200).json({ message: "Variant deleted" });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function generateVariants(req: Request, res: Response) {
  try {
    const productId = req.params.id as string;
    const { attributeGroups, basePrice, baseStock } = req.body;

    if (!attributeGroups || !basePrice) {
      return res.status(400).json({ message: "attributeGroups and basePrice are required" });
    }

    const variants = await productService.generateVariantsService(productId, {
      attributeGroups,
      basePrice: Number(basePrice),
      baseStock: baseStock ? Number(baseStock) : undefined,
    });

    return res.status(201).json({
      message: `${variants.length} variants generated`,
      data: variants,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function updateVariant(req: Request, res: Response) {
  try {
    const variantId = req.params.variantId as string;
    const { name, price, stock } = req.body;

    const files = (req.files as Express.Multer.File[]) || [];
    const images = files.length > 0 ? files.map((file) => `/uploads/${file.filename}`) : undefined;

    const variant = await productService.updateVariantService(variantId, {
      name,
      price: price ? Number(price) : undefined,
      stock: stock ? Number(stock) : undefined,
      images,
    });

    return res.status(200).json({ message: "Variant updated", data: variant });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}