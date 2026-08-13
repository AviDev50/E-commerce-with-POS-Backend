import { Request, Response } from "express";
import * as websiteSearchService from "./websiteSearch.service.js";

export async function getSearchSuggestions(req: Request, res: Response) {
  try {
    const q = (req.query.q as string) || "";
    const limit = req.query.limit ? Number(req.query.limit) : 8;

    const result = await websiteSearchService.getSearchSuggestionsService(q, limit);
    return res.status(200).json({ data: result });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}