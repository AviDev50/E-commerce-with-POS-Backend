import { Request, Response } from "express";
import * as heldOrderService from "./heldOrder.service.js";

export async function holdOrder(req: Request, res: Response) {
  try {
    const { items, customerId, note } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "items are required" });
    }

    const held = await heldOrderService.holdOrderService({
      cashierId: req.user!.id,
      customerId,
      items,
      note,
    });

    return res.status(201).json({ message: "Order held", data: held });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}

export async function listHeldOrders(req: Request, res: Response) {
  try {
    const { cashierId } = req.query;
    const held = await heldOrderService.listHeldOrdersService({
      cashierId: cashierId as string | undefined,
    });
    return res.status(200).json({ data: held });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}

export async function getHeldOrderById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const held = await heldOrderService.getHeldOrderByIdService(id);
    return res.status(200).json({ data: held });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}

export async function resumeHeldOrder(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const held = await heldOrderService.resumeHeldOrderService(id);
    return res.status(200).json({ message: "Order resumed", data: held });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}

export async function cancelHeldOrder(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const held = await heldOrderService.cancelHeldOrderService(id);
    return res.status(200).json({ message: "Held order cancelled", data: held });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}