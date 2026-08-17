import { Request, Response } from "express";
import * as reportsService from "./reports.service.js";

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