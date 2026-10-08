import { Request, Response } from "express";
import * as walletService from "./wallet.service.js";

export async function getMyWallet(req: Request, res: Response) {
  try {
    const data = await walletService.getMyWalletService(req.customer!.id);
    return res.status(200).json({ data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

export async function getMyWalletTransactions(req: Request, res: Response) {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const data = await walletService.getMyWalletTransactionsService(req.customer!.id, page, limit);
    return res.status(200).json({ data: data.items, pagination: data.pagination });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}