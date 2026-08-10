import { Request, Response } from "express";
import * as dashboardService from "./dashboard.service.js";

export async function getSummary(req: Request, res: Response) {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const data = await dashboardService.getDashboardSummary({ from, to });
    res.status(200).json({ message: "Dashboard summary fetched successfully", data });
  } catch (error: any) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
}