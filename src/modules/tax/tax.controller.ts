import { Request, Response } from "express";
import * as taxService from "./tax.service.js";

export async function createTaxClass(req: Request, res: Response) {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }
    const taxClass = await taxService.createTaxClassService({ name });
    return res.status(201).json({ message: "Tax class created", data: taxClass });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function getAllTaxClasses(_req: Request, res: Response) {
  try {
    const taxClasses = await taxService.getAllTaxClassesService();
    return res.status(200).json({ data: taxClasses });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function deleteTaxClass(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    await taxService.deleteTaxClassService(id);
    return res.status(200).json({ message: "Tax class deleted" });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function createTaxRate(req: Request, res: Response) {
  try {
    const { taxClassId, country, state, name, rate, appliesWhen, isCompound, priority } = req.body;

    if (!taxClassId || !country || !name || rate === undefined || !appliesWhen) {
      return res.status(400).json({
        message: "taxClassId, country, name, rate, and appliesWhen are required",
      });
    }

    const taxRate = await taxService.createTaxRateService({
      taxClassId,
      country,
      state,
      name,
      rate: Number(rate),
      appliesWhen,
      isCompound,
      priority: priority ? Number(priority) : undefined,
    });

    return res.status(201).json({ message: "Tax rate created", data: taxRate });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function getTaxRatesByClass(req: Request, res: Response) {
  try {
    const taxClassId = req.params.taxClassId as string;
    const rates = await taxService.getTaxRatesByClassService(taxClassId);
    return res.status(200).json({ data: rates });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function deleteTaxRate(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    await taxService.deleteTaxRateService(id);
    return res.status(200).json({ message: "Tax rate deleted" });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function updateTaxClass(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { name } = req.body;

    const taxClass = await taxService.updateTaxClassService(id, { name });
    return res.status(200).json({ message: "Tax class updated", data: taxClass });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function updateTaxRate(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { country, state, name, rate, appliesWhen, isCompound, priority } = req.body;

    const taxRate = await taxService.updateTaxRateService(id, {
      country,
      state,
      name,
      rate: rate !== undefined ? Number(rate) : undefined,
      appliesWhen,
      isCompound,
      priority: priority !== undefined ? Number(priority) : undefined,
    });

    return res.status(200).json({ message: "Tax rate updated", data: taxRate });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}