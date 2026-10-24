import { Request, Response } from "express";
import * as cartService from "./cart.service.js";

export async function getCart(req: Request, res: Response) {
  try {
    const customerId = (req as any).customer.id;
    const cart = await cartService.getCartService(customerId);
    return res.status(200).json({ data: cart });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function addToCart(req: Request, res: Response) {
  try {
    const customerId = (req as any).customer.id;
    const { productId, variantId, quantity } = req.body;

    const cart = await cartService.addToCartService(customerId, {
      productId,
      variantId,
      quantity: Number(quantity),
    });

    return res.status(200).json({ message: "Item added to cart", data: cart });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function updateCartItem(req: Request, res: Response) {
  try {
    const customerId = (req as any).customer.id;
    const itemId = req.params.id as string;
    const { quantity } = req.body;

    const cart = await cartService.updateCartItemService(
      customerId,
      itemId,
      Number(quantity),
    );
    return res.status(200).json({ message: "Cart item updated", data: cart });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function removeCartItem(req: Request, res: Response) {
  try {
    const customerId = (req as any).customer.id;
    const itemId = req.params.id as string;

    const cart = await cartService.removeCartItemService(customerId, itemId);
    return res
      .status(200)
      .json({ message: "Item removed from cart", data: cart });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function clearCart(req: Request, res: Response) {
  try {
    const customerId = (req as any).customer.id;
    const cart = await cartService.clearCartService(customerId);
    return res.status(200).json({ message: "Cart cleared", data: cart });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}
