import { Request, Response } from "express";
import * as shiftService from "./shift.service.js";

export async function openShift(req: Request, res: Response) {
  try {
    const { openingCash } = req.body;

    if (typeof openingCash !== "number" || openingCash < 0) {
      return res.status(400).json({ message: "openingCash is required and must be >= 0" });
    }

    const shift = await shiftService.openShiftService({
      cashierId: req.user!.id,
      openingCash,
    });

    return res.status(201).json({ message: "Shift opened", data: shift });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}

export async function getActiveShift(req: Request, res: Response) {
  try {
    const shift = await shiftService.getActiveShiftService(req.user!.id);
    return res.status(200).json({ data: shift }); // null aayega agar koi active shift nahi
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}

export async function closeShift(req: Request, res: Response) {
  try {
    const { closingCash } = req.body;
    const shiftId = req.params.id as string;

    if (typeof closingCash !== "number" || closingCash < 0) {
      return res.status(400).json({ message: "closingCash is required and must be >= 0" });
    }

    const shift = await shiftService.closeShiftService({
      shiftId,
      cashierId: req.user!.id,
      closingCash,
    });

    return res.status(200).json({ message: "Shift closed", data: shift });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}

export async function listShifts(req: Request, res: Response) {
  try {
    const { cashierId, status } = req.query;
    const shifts = await shiftService.listShiftsService({
      cashierId: cashierId as string | undefined,
      status: status as any,
    });
    return res.status(200).json({ data: shifts });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}