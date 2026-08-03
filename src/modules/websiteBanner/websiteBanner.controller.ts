import { Request, Response } from "express";
import * as websiteBannerService from "./websiteBanner.service.js";

export async function getActiveBanners(_req: Request, res: Response) {
  try {
    const banners = await websiteBannerService.getActiveBannersService();
    return res.status(200).json({ data: banners });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}