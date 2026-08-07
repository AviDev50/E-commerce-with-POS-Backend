import { Request, Response } from "express";
import * as service from "./websiteReturns.service.js";
import { ReturnType } from "@prisma/client";
import { getParam } from "../../utils/getParam.js";
// ==================== CREATE ====================
export async function createReturnRequest(req: Request, res: Response) {
  try {
    const customerId = req.customer!.id;
    const { orderItemId, type, reason, reasonNote, quantity, exchangeVariantId } = req.body;

    const files = req.files as Express.Multer.File[] | undefined;
    const images = files ? files.map((f) => f.filename) : undefined; // ab plain array, JSON.stringify nahi

    const data = await service.createReturnRequest(customerId, {
      orderItemId,
      type: type as ReturnType,
      reason,
      reasonNote,
      images,
      quantity: Number(quantity),
      exchangeVariantId,
    });

    res.status(201).json({ success: true, data });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

// ==================== LIST OWN ====================
export async function listMyReturns(req: Request, res: Response) {
  try {
    const data = await service.listMyReturns(req.customer!.id);
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

export async function getMyReturnById(req: Request, res: Response) {
  try {
    const data = await service.getMyReturnById(req.customer!.id, getParam(req.params.id));
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

export async function cancelMyReturn(req: Request, res: Response) {
  try {
    const data = await service.cancelMyReturn(req.customer!.id, getParam(req.params.id));
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}
