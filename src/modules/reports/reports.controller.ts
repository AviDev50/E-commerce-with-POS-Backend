import { Request, Response } from "express";
import * as reportsService from "./reports.service.js";
import { OrderChannel, ReturnType } from "@prisma/client";

export async function getReturnsExchangeReport(req: Request, res: Response) {
  try {
    const { from, to, type, channel, page, limit } = req.query;

    if (type && !Object.values(ReturnType).includes(type as ReturnType)) {
      return res.status(400).json({ message: "Invalid type" });
    }
    if (
      channel &&
      !Object.values(OrderChannel).includes(channel as OrderChannel)
    ) {
      return res.status(400).json({ message: "Invalid channel" });
    }

    const report = await reportsService.getReturnsExchangeReportService({
      from: from as string | undefined,
      to: to as string | undefined,
      type: type as ReturnType | undefined,
      channel: channel as OrderChannel | undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      requestingUserId: req.user!.id,
      requestingUserRole: req.user!.role,
    });

    return res.status(200).json({ data: report });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}

export async function getDailySalesReport(req: Request, res: Response) {
  try {
    const { from, to, cashierId } = req.query;

    const report = await reportsService.getDailySalesReportService({
      from: from as string | undefined,
      to: to as string | undefined,
      cashierId: cashierId as string | undefined,
      requestingUserId: req.user!.id,
      requestingUserRole: req.user!.role,
    });

    return res.status(200).json({ data: report });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}
