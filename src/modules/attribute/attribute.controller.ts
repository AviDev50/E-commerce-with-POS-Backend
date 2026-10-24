import { Request, Response } from "express";
import {
  createAttributeService,
  getAllAttributesService,
  addAttributeValueService,
  deleteAttributeValueService,
  deleteAttributeService,
} from "./attribute.service.js";

export const createAttribute = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }

    const attribute = await createAttributeService({ name });
    return res
      .status(201)
      .json({ message: "Attribute created", data: attribute });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};

export const getAllAttributes = async (_req: Request, res: Response) => {
  try {
    const attributes = await getAllAttributesService();
    return res.status(200).json({ data: attributes });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const addAttributeValue = async (req: Request, res: Response) => {
  try {
    const { attributeId, value } = req.body;

    if (!attributeId || !value) {
      return res
        .status(400)
        .json({ message: "attributeId and value are required" });
    }

    const attributeValue = await addAttributeValueService({
      attributeId,
      value,
    });
    return res
      .status(201)
      .json({ message: "Attribute value added", data: attributeValue });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};

export const deleteAttributeValue = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await deleteAttributeValueService(id);
    return res.status(200).json({ message: "Attribute value deleted" });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};

export const deleteAttribute = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await deleteAttributeService(id);
    return res.status(200).json({ message: "Attribute deleted" });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};
