import { Request, Response } from "express";
import * as service from "./payoutMethods.service.js";
import { getParam } from "../../utils/getParam.js";

export async function addPayoutMethod(req: Request, res: Response) {
  try {
    const data = await service.addPayoutMethodService(req.customer!.id, {
      upiId: req.body.upiId,
      label: req.body.label,
    });
    res.status(201).json({ success: true, data });
  } catch (err: any) {
    res
      .status(err.statusCode || 500)
      .json({ success: false, message: err.message });
  }
}

export async function listPayoutMethods(req: Request, res: Response) {
  try {
    const data = await service.listPayoutMethodsService(req.customer!.id);
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    res
      .status(err.statusCode || 500)
      .json({ success: false, message: err.message });
  }
}

export async function deletePayoutMethod(req: Request, res: Response) {
  try {
    await service.deletePayoutMethodService(
      req.customer!.id,
      getParam(req.params.id),
    );
    res.status(200).json({ success: true, message: "Payout method deleted" });
  } catch (err: any) {
    res
      .status(err.statusCode || 500)
      .json({ success: false, message: err.message });
  }
}
