import { Request, Response } from "express";
import * as pageService from "./page.service.js";
import { PageType } from "@prisma/client";

const VALID_TYPES: PageType[] = [
  "ABOUT_US",
  "TERMS_AND_CONDITIONS",
  "PRIVACY_POLICY",
  "RETURN_AND_REFUND_POLICY",
];

export async function getAllPages(_req: Request, res: Response) {
  try {
    const pages = await pageService.getAllPagesService();
    return res.status(200).json({ data: pages });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getPageByType(req: Request, res: Response) {
  try {
    const type = req.params.type as PageType;

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ message: "Invalid page type" });
    }

    const page = await pageService.getPageByTypeService(type);
    return res.status(200).json({ data: page });
  } catch (error: any) {
    return res.status(404).json({ message: error.message });
  }
}

export async function upsertPage(req: Request, res: Response) {
  try {
    const type = req.params.type as PageType;
    const { title, content } = req.body;

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ message: "Invalid page type" });
    }

    const page = await pageService.upsertPageService(type, title, content);
    return res.status(200).json({ message: "Page updated", data: page });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}