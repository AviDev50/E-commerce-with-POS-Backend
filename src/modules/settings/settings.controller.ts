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
    const { businessName, logoUrl, email, phone, address, state, country, currency, returnWindowDays, legalName, gstin, invoicePrefix } = req.body;

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

    // "" ya null = GSTIN hata do (unregistered client)
    let gstinValue: string | null | undefined;
    if (gstin !== undefined) {
      gstinValue = String(gstin ?? "").trim().toUpperCase() || null;
      if (gstinValue && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(gstinValue)) {
        return res.status(400).json({ message: "Invalid GSTIN format" });
      }
    }

    let prefix: string | undefined;
    if (invoicePrefix !== undefined) {
      prefix = String(invoicePrefix).trim().toUpperCase();
      if (!/^[A-Z0-9]{1,3}$/.test(prefix)) {
        return res.status(400).json({ message: "invoicePrefix must be 1-3 letters or digits" });
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
      legalName,
      gstin: gstinValue,
      invoicePrefix: prefix,
    });

    return res.status(200).json({ message: "Store settings saved", data: settings });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}