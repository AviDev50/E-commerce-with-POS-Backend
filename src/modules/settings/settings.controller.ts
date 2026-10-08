import { Request, Response } from "express";
import * as settingsService from "./settings.service.js";

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
    const { businessName, logoUrl, email, phone, address, state, country, currency, returnWindowDays } = req.body;

    if (!businessName) {
      return res.status(400).json({ message: "businessName is required" });
    }

    // 0 = returns band, 365 tak allowed
    let windowDays: number | undefined;
    if (returnWindowDays !== undefined) {
      windowDays = Number(returnWindowDays);
      if (!Number.isInteger(windowDays) || windowDays < 0 || windowDays > 365) {
        return res
          .status(400)
          .json({ message: "returnWindowDays must be a whole number between 0 and 365" });
      }
    }

    const settings = await settingsService.upsertStoreSettingsService({
      businessName,
      logoUrl,
      email,
      phone,
      address,
      state,
      country,
      currency,
      returnWindowDays: windowDays,
    });

    return res.status(200).json({ message: "Store settings saved", data: settings });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}