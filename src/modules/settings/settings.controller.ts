import { Request, Response } from "express";
import * as settingsService from "./settings.service";

export async function getStoreSettings(_req: Request, res: Response) {
  try {
    const settings = await settingsService.getStoreSettingsService();
    return res.status(200).json({ data: settings });
  } catch (error: any) {
    return res.status(404).json({ message: error.message });
  }
}

export async function upsertStoreSettings(req: Request, res: Response) {
  try {
    const { businessName, logoUrl, email, phone, address, state, currency, taxPercent } = req.body;

    if (!businessName) {
      return res.status(400).json({ message: "businessName is required" });
    }

    const settings = await settingsService.upsertStoreSettingsService({
      businessName,
      logoUrl,
      email,
      phone,
      address,
      state,
      currency,
      taxPercent: taxPercent ? Number(taxPercent) : undefined,
    });

    return res.status(200).json({ message: "Store settings saved", data: settings });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}