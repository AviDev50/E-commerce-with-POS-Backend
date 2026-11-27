import { Request, Response } from "express";
import * as invoiceService from "./invoice.service.js";
import { renderInvoicePdf } from "./invoice.pdf.js";
// import { hasPermission } from "../../middlewares/permission.middleware.js";
import { getParam } from "../../utils/getParam.js";

export async function downloadInvoice(req: Request, res: Response) {
  try {
if (req.user) {
  if (req.user.role !== "ADMIN" && req.user.role !== "MANAGER") {
    return res
      .status(403)
      .json({ message: "You do not have permission to download invoices" });
  }
} else if (!req.customer) {
  return res.status(401).json({ message: "Unauthorized" });
}

    const data = await invoiceService.getInvoiceForDownload(
      getParam(req.params.id),
      req.customer?.id,
    );
    const buffer = await renderInvoicePdf(data); // poora banne ke baad bhejo, adhoori file nahi jayegi

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${data.invoiceNumber}.pdf"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(buffer);
  } catch (error: any) {
    if (!error.statusCode) console.error("[INVOICE]", error);
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Could not generate invoice",
    });
  }
}