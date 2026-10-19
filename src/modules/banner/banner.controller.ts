import { Request, Response } from "express";
import * as bannerService from "./banner.service.js";

export async function createBanner(req: Request, res: Response) {
  try {
    const { title, linkUrl, sortOrder } = req.body;
    const imageUrl = req.file
      ? `/uploads/${req.file.filename}`
      : req.body.imageUrl;

    if (!imageUrl) {
      return res
        .status(400)
        .json({ message: "imageUrl (or uploaded image) is required" });
    }

    const banner = await bannerService.createBannerService({
      title,
      imageUrl,
      linkUrl,
      sortOrder: sortOrder ? Number(sortOrder) : undefined,
    });

    return res.status(201).json({ message: "Banner created", data: banner });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function getAllBanners(_req: Request, res: Response) {
  try {
    const banners = await bannerService.getAllBannersService();
    return res.status(200).json({ data: banners });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getBannerById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const banner = await bannerService.getBannerByIdService(id);
    return res.status(200).json({ data: banner });
  } catch (error: any) {
    return res.status(404).json({ message: error.message });
  }
}

export async function updateBanner(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { title, linkUrl, sortOrder, isActive } = req.body;
    const imageUrl = req.file
      ? `/uploads/${req.file.filename}`
      : req.body.imageUrl;

    const banner = await bannerService.updateBannerService(id, {
      title,
      imageUrl,
      linkUrl,
      sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
      isActive:
        isActive !== undefined
          ? isActive === "true" || isActive === true
          : undefined,
    });

    return res.status(200).json({ message: "Banner updated", data: banner });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function deleteBanner(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    await bannerService.deleteBannerService(id);
    return res.status(200).json({ message: "Banner deleted" });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}
