import prisma from "../../config/db.js";
import razorpay from "../../config/razorpay.js";
import crypto from "crypto";
import { previewOnlineOrderService, createConfirmedOrderService } from "../order/order.service.js";
import { getCartAsOrderItemsService } from "../carts/cart.service.js";
import { PaymentMethod } from "@prisma/client"

function mapRazorpayMethod(method: string): PaymentMethod {
  switch (method) {
    case "card":
      return "CARD";
    case "upi":
      return "UPI";
    case "wallet":
      return "WALLET";
    case "netbanking":
      return "NETBANKING";
    default:
      return "CARD"; // emi ya koi naya/unknown method ka safe fallback
  }
}

export async function createRazorpayOrderService(customerId: string, addressId: string, couponCode?: string) {
  const { items } = await getCartAsOrderItemsService(customerId);

  const preview = await previewOnlineOrderService({ items, addressId, couponCode, customerId });

  if (preview.couponError) {
    throw new Error(preview.couponError);
  }

  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(preview.total * 100), // paise mein
    currency: "INR",
    notes: {
      customerId,
      addressId,
      couponCode: couponCode || "",
    },
  });

  return {
    razorpayOrderId: razorpayOrder.id,
    amount: preview.total,
    currency: "INR",
    keyId: process.env.RAZORPAY_KEY_ID,
  };
}

function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  const generated = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET as string)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return generated === signature;
}

function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const generated = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET as string)
    .update(rawBody)
    .digest("hex");
  return generated === signature;
}

// Verify (frontend) aur Webhook (Razorpay server) dono isi ek function ko call karenge —
// taaki order-creation logic sirf ek jagah rahe, dono paths sync rahein
async function confirmRazorpayOrder(razorpayOrderId: string, razorpayPaymentId: string, paymentMethod: PaymentMethod) {
  const existing = await prisma.order.findUnique({ where: { gatewayOrderId: razorpayOrderId } });
  if (existing) return existing;

  const rzpOrder = await razorpay.orders.fetch(razorpayOrderId);
  const notes = rzpOrder.notes as { customerId?: string; addressId?: string; couponCode?: string };

  if (!notes?.customerId || !notes?.addressId) {
    throw new Error("Order metadata missing — cannot confirm payment");
  }

  const { items, cartItemIds } = await getCartAsOrderItemsService(notes.customerId);

  const order = await createConfirmedOrderService({
    customerId: notes.customerId,
    addressId: notes.addressId,
    couponCode: notes.couponCode || undefined,
    items,
    payment: { method: paymentMethod, status: "PAID", transactionRef: razorpayPaymentId }, // ⬅️ ab actual method
    status: "PENDING",
    gatewayOrderId: razorpayOrderId,
    cartItemIds,
  });

  return order;
}

export async function verifyRazorpayPaymentService(orderId: string, paymentId: string, signature: string) {
  if (!verifySignature(orderId, paymentId, signature)) {
    throw new Error("Payment verification failed — signature mismatch");
  }

  // Verify call mein Razorpay method nahi bhejta, isliye extra fetch karna padega
  const paymentDetails = await razorpay.payments.fetch(paymentId);
  const method = mapRazorpayMethod(paymentDetails.method);

  return confirmRazorpayOrder(orderId, paymentId, method);
}

export async function handleRazorpayWebhookService(rawBody: string, signature: string) {
  if (!verifyWebhookSignature(rawBody, signature)) {
    throw new Error("Invalid webhook signature");
  }

  const payload = JSON.parse(rawBody);

  if (payload.event !== "payment.captured") {
    return { skipped: true, event: payload.event };
  }

  const paymentEntity = payload.payload.payment.entity;
  const method = mapRazorpayMethod(paymentEntity.method); // ⬅️ webhook payload mein directly available

  return confirmRazorpayOrder(paymentEntity.order_id, paymentEntity.id, method);
}