import { Request, Response } from "express";
import * as service from "./returns.service.js";
import { ReturnStatus, ReturnType } from "@prisma/client";
import { getParam } from "../../utils/getParam.js";

export async function listReturns(req: Request, res: Response) {
  try {
    const { status, type, page, limit } = req.query;
    const result = await service.listReturns({
      status: status as ReturnStatus | undefined,
      type: type as ReturnType | undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

export async function getReturnById(req: Request, res: Response) {
  try {
    const data = await service.getReturnById(getParam(req.params.id));
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

export async function approveReturn(req: Request, res: Response) {
  try {
    const data = await service.approveReturn(getParam(req.params.id), req.user!.id);
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

export async function rejectReturn(req: Request, res: Response) {
  try {
    const data = await service.rejectReturn(getParam(req.params.id), req.user!.id, req.body.reasonNote);
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

export async function schedulePickup(req: Request, res: Response) {
  try {
    const data = await service.schedulePickup(getParam(req.params.id));
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

export async function markReceived(req: Request, res: Response) {
  try {
    const data = await service.markReceived(getParam(req.params.id));
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

export async function processRefund(req: Request, res: Response) {
  try {
    const data = await service.processRefund(getParam(req.params.id), req.user!.id);
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

export async function processExchange(req: Request, res: Response) {
  try {
    const data = await service.processExchange(getParam(req.params.id), req.user!.id);
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}