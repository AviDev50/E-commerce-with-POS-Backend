import { Request, Response } from "express";
import * as razorpayService from "./razorpay.service.js";

export async function createRazorpayOrder(req: Request, res: Response) {
  try {
    const customerId = req.customer!.id;
    const { items, addressId, couponCode, cartItemIds } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0 || !addressId) {
      return res.status(400).json({ message: "items and addressId are required" });
    }
    if (cartItemIds !== undefined && !Array.isArray(cartItemIds)) {
      return res.status(400).json({ message: "cartItemIds must be an array" });
    }

    const result = await razorpayService.createRazorpayOrderService(customerId, {
      items,
      addressId,
      couponCode,
      cartItemIds,
    });
    return res.status(200).json({ message: "Razorpay order created", data: result });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}

export async function verifyRazorpayPayment(req: Request, res: Response) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment verification fields" });
    }

    const order = await razorpayService.verifyRazorpayPaymentService(
      req.customer!.id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );
    return res.status(200).json({ message: "Payment verified, order placed", data: order });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}

export async function razorpayWebhook(req: Request, res: Response) {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;
    const rawBody = (req as any).rawBody?.toString() || "";

    const result = await razorpayService.handleRazorpayWebhookService(rawBody, signature);
    return res.status(200).json({ status: "ok", data: result });
  } catch (error: any) {
    // sirf invalid signature pe 400; baaki business failures pe 200, warna Razorpay retry storm karega
    if (error.statusCode === 400) {
      return res.status(400).json({ message: error.message });
    }
    console.error("[RAZORPAY WEBHOOK]", error.message);
    return res.status(200).json({ status: "handled", message: error.message });
  }
}