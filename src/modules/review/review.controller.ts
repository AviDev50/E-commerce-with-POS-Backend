import { Request, Response } from "express";
import * as reviewService from "./review.service";

export async function createReview(req: Request, res: Response) {
  try {
    const { productId, rating, comment } = req.body;

    if (!productId || !rating) {
      return res.status(400).json({ message: "productId and rating are required" });
    }

    const files = (req.files as Express.Multer.File[]) || [];
    const images = files.map((file) => `/uploads/${file.filename}`);

    const review = await reviewService.createReviewService({
      productId,
      customerId: req.customer!.id,
      rating: Number(rating),
      comment,
      images,
    });

    return res.status(201).json({
      message: "Review submitted, pending approval",
      data: review,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function getReviewsByProduct(req: Request, res: Response) {
  try {
    const productId = req.params.productId as string;

    const includeUnapproved =
      !!req.user && (req.user.role === "ADMIN" || req.user.role === "MANAGER");

    const reviews = await reviewService.getReviewsByProductService(productId, includeUnapproved);
    return res.status(200).json({ data: reviews });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function moderateReview(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { isApproved } = req.body;

    if (isApproved === undefined) {
      return res.status(400).json({ message: "isApproved is required" });
    }

    const review = await reviewService.moderateReviewService(id, Boolean(isApproved));
    return res.status(200).json({ message: "Review moderated", data: review });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function deleteReview(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    // Staff hai to kisi ka bhi delete kar sakta hai, customer hai to sirf apna
    const requesterCustomerId = req.customer ? req.customer.id : undefined;

    await reviewService.deleteReviewService(id, requesterCustomerId);
    return res.status(200).json({ message: "Review deleted" });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}