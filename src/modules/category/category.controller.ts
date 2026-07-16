import { Request, Response } from "express";
import * as categoryService from "./category.service";

export async function createCategory(req: Request, res: Response) {
  try {
    const { name, slug, parentId, taxRate } = req.body;

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }

    const category = await categoryService.createCategoryService({
      name,
      slug,
      parentId,
      taxRate: taxRate ? Number(taxRate) : undefined,
    });

    return res.status(201).json({ message: "Category created", data: category });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function getAllCategories(_req: Request, res: Response) {
  try {
    const categories = await categoryService.getAllCategoriesService();
    return res.status(200).json({ data: categories });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getCategoryById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const category = await categoryService.getCategoryByIdService(id);
    return res.status(200).json({ data: category });
  } catch (error: any) {
    return res.status(404).json({ message: error.message });
  }
}

export async function updateCategory(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { name, slug, parentId, taxRate } = req.body;

    const category = await categoryService.updateCategoryService(id, {
      name,
      slug,
      parentId,
      taxRate: taxRate ? Number(taxRate) : undefined,
    });

    return res.status(200).json({ message: "Category updated", data: category });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function deleteCategory(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    await categoryService.deleteCategoryService(id);
    return res.status(200).json({ message: "Category deleted" });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}