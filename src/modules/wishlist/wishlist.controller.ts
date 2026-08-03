import { Request, Response } from "express";
import * as wishlistService from "./wishlist.service.js";

// ==================== TOGGLE WISHLIST ====================
export async function toggleWishlist(req: Request, res: Response) {
  try {
    const customerId = (req as any).customer.id; // apne project ke customer-auth type ke hisaab se cast/type badal lena
    const { productId, variantId } = req.body;

    const result = await wishlistService.toggleWishlist(customerId, productId, variantId);
    res.status(200).json({ message: "Wishlist updated", data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    res.status(400).json({ message, data: null });
  }
}

// ==================== GET WISHLIST ====================
export async function getWishlist(req: Request, res: Response) {
  try {
    const customerId = (req as any).customer.id;
    const items = await wishlistService.getWishlist(customerId);
    res.status(200).json({ message: "Wishlist fetched", data: items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    res.status(400).json({ message, data: null });
  }
}

// ==================== MOVE TO CART ====================
export async function moveToCart(req: Request<{ id: string }>, res: Response) {
  try {
    const customerId = (req as any).customer.id;
    const { id } = req.params; // ab ye strictly `string` hoga

    const result = await wishlistService.moveToCart(customerId, id);
    res.status(200).json({ message: "Moved to cart", data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    res.status(400).json({ message, data: null });
  }
}