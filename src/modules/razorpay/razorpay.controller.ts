import { Request, Response } from "express";
import * as razorpayService from "./razorpay.service.js";

export async function createRazorpayOrder(req: Request, res: Response) {
  try {
    const customerId = req.customer!.id;
    const { addressId, couponCode } = req.body;

    if (!addressId) {
      return res.status(400).json({ message: "addressId is required" });
    }

    const result = await razorpayService.createRazorpayOrderService(
      customerId,
      addressId,
      couponCode,
    );
    return res
      .status(200)
      .json({ message: "Razorpay order created", data: result });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function verifyRazorpayPayment(req: Request, res: Response) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res
        .status(400)
        .json({ message: "Missing payment verification fields" });
    }

    const order = await razorpayService.verifyRazorpayPaymentService(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    return res
      .status(200)
      .json({ message: "Payment verified, order placed", data: order });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function razorpayWebhook(req: Request, res: Response) {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;
    const rawBody = (req as any).rawBody?.toString() || "";

    const result = await razorpayService.handleRazorpayWebhookService(
      rawBody,
      signature,
    );
    return res.status(200).json({ status: "ok", data: result });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}
