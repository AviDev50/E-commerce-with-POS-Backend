import { Request, Response } from "express";
import { PosPageType } from "@prisma/client";
import * as service from "./pos-page.service.js";

const VALID_TYPES = Object.values(PosPageType);

function isValidType(t: string): t is PosPageType {
  return (VALID_TYPES as string[]).includes(t);
}

// ---------- Authenticated ----------
export async function getAllPosPages(_req: Request, res: Response) {
  try {
    const pages = await service.getAllPosPagesService();
    return res.status(200).json({ data: pages });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getPosPageByType(req: Request, res: Response) {
  try {
    const type = req.params.type as string;
    if (!isValidType(type)) {
      return res.status(400).json({ message: "Invalid page type" });
    }
    const page = await service.getPosPageByTypeService(type);
    if (!page) {
      return res
        .status(404)
        .json({ message: "Content not set yet for this page type" });
    }
    return res.status(200).json({ data: page });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function upsertPosPage(req: Request, res: Response) {
  try {
    const type = req.params.type as string;
    if (!isValidType(type)) {
      return res.status(400).json({ message: "Invalid page type" });
    }
    const { title, content } = req.body ?? {};
    const page = await service.upsertPosPageService(type, title, content);
    return res.status(200).json({ message: "Page updated", data: page });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

// ---------- Public (no login) ----------
export async function getPublicPosPage(req: Request, res: Response) {
  try {
    const type = req.params.type as string;
    if (!isValidType(type)) {
      return res.status(404).json({ message: "Not found" });
    }
    const page = await service.getPosPageByTypeService(type);
    if (!page) {
      return res.status(404).json({ message: "Not found" });
    }
    return res.status(200).json({
      data: {
        type: page.type,
        title: page.title,
        content: page.content,
        updatedAt: page.updatedAt,
      },
    });
  } catch {
    return res.status(500).json({ message: "Something went wrong" });
  }
}
