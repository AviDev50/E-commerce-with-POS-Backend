import prisma from "../../config/db.js";
import razorpay from "../../config/razorpay.js";
import crypto from "crypto";
import { Prisma, PaymentMethod } from "@prisma/client";
import {
  previewOnlineOrderService,
  createConfirmedOrderService,
} from "../order/order.service.js";

interface CheckoutItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

function httpError(message: string, statusCode = 400) {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function mapRazorpayMethod(method: string): PaymentMethod {
  switch (method) {
    case "card": return "CARD";
    case "upi": return "UPI";
    case "wallet": return "WALLET";
    case "netbanking": return "NETBANKING";
    default: return "CARD";
  }
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a || "");
  const bb = Buffer.from(b || "");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function verifySignature(orderId: string, paymentId: string, signature: string) {
  const generated = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET as string)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqual(generated, signature);
}

function verifyWebhookSignature(rawBody: string, signature: string) {
  const generated = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET as string)
    .update(rawBody)
    .digest("hex");
  return safeEqual(generated, signature);
}

// cartItemIds aaye to wo isi customer ke cart ke hon aur items se exactly match karein
async function assertCartItemsMatch(
  customerId: string,
  items: CheckoutItem[],
  cartItemIds: string[],
) {
  if (new Set(cartItemIds).size !== cartItemIds.length) {
    throw httpError("Duplicate cartItemIds");
  }
  const rows = await prisma.cartItem.findMany({
    where: { id: { in: cartItemIds }, cart: { customerId } },
  });
  if (rows.length !== cartItemIds.length) {
    throw httpError("Invalid cart items");
  }
  const key = (p: string, v: string | null | undefined, q: number) =>
    `${p}|${v ?? ""}|${q}`;
  const a = rows.map((r) => key(r.productId, r.variantId, r.quantity)).sort();
  const b = items.map((i) => key(i.productId, i.variantId, i.quantity)).sort();
  if (a.length !== b.length || a.some((k, i) => k !== b[i])) {
    throw httpError("Items do not match the selected cart items");
  }
}

export async function createRazorpayOrderService(
  customerId: string,
  input: {
    items: CheckoutItem[];
    addressId: string;
    couponCode?: string;
    cartItemIds?: string[];
  },
) {
  const { items, addressId, couponCode, cartItemIds } = input;

  if (cartItemIds && cartItemIds.length > 0) {
    await assertCartItemsMatch(customerId, items, cartItemIds);
  }

  const preview = await previewOnlineOrderService({
    items,
    addressId,
    couponCode,
    customerId,
  });

  if (preview.couponError) throw httpError(preview.couponError);

  const outOfStock = preview.items.find((i: any) => !i.inStock);
  if (outOfStock) {
    throw httpError(`Insufficient stock for: ${outOfStock.productName}`);
  }

  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(preview.total * 100), // paise
    currency: "INR",
    receipt: `rcpt_${Date.now()}`,
    notes: { customerId }, // sirf debugging; source of truth DB record hai
  });

  await prisma.pendingCheckout.create({
    data: {
      customerId,
      addressId,
      couponCode: couponCode || null,
      items: items as unknown as Prisma.InputJsonValue,
      cartItemIds: (cartItemIds ?? []) as unknown as Prisma.InputJsonValue,
      expectedTotal: preview.total,
      gatewayOrderId: razorpayOrder.id,
    },
  });

  return {
    razorpayOrderId: razorpayOrder.id,
    amount: preview.total, // rupees — frontend *100 karega
    currency: "INR",
    keyId: process.env.RAZORPAY_KEY_ID,
  };
}

async function handleConfirmFailure(
  pendingId: string,
  gatewayOrderId: string,
  paymentId: string,
  paidPaise: number,
  reason: string,
): Promise<never | any> {
  // sirf ek caller (verify ya webhook) failure claim karega -> double refund nahi
  const claimed = await prisma.pendingCheckout.updateMany({
    where: { id: pendingId, status: "PENDING" },
    data: { status: "FAILED", failureReason: reason.slice(0, 500) },
  });

  if (claimed.count === 0) {
    const order = await prisma.order.findUnique({ where: { gatewayOrderId } });
    if (order) return order; // dusre path ne order bana diya
    throw httpError("Order could not be placed. Refund is being processed.", 409);
  }

  try {
    const refund = await razorpay.payments.refund(paymentId, {
      amount: paidPaise,
      notes: { reason: reason.slice(0, 200) },
    });
    await prisma.pendingCheckout.update({
      where: { id: pendingId },
      data: { refundId: refund.id },
    });
  } catch (e: any) {
    console.error("[RAZORPAY] AUTO-REFUND FAILED", { paymentId, gatewayOrderId, e });
    await prisma.pendingCheckout.update({
      where: { id: pendingId },
      data: { failureReason: `${reason} | REFUND FAILED - manual refund needed`.slice(0, 500) },
    });
  }

  throw httpError(
    `Order could not be placed (${reason}). Your payment will be refunded.`,
    409,
  );
}

// verify aur webhook dono yahi call karte hain
async function confirmRazorpayOrder(
  gatewayOrderId: string,
  paymentId: string,
  method: PaymentMethod,
  paidPaise: number,
  customerId?: string,
) {
  const existing = await prisma.order.findUnique({ where: { gatewayOrderId } });
  if (existing) return existing;

  const pending = await prisma.pendingCheckout.findUnique({
    where: { gatewayOrderId },
  });
  if (!pending) throw httpError("Checkout session not found", 404);
  if (customerId && pending.customerId !== customerId) {
    throw httpError("Forbidden", 403);
  }
  if (pending.status === "FAILED") {
    throw httpError("Order could not be placed. Refund is being processed.", 409);
  }

  const items = pending.items as unknown as CheckoutItem[];
  const cartItemIds = (pending.cartItemIds as unknown as string[]) ?? [];

  try {
    // abhi ka total recompute karo; paid amount se match na ho to order nahi banega
    const preview = await previewOnlineOrderService({
      items,
      addressId: pending.addressId,
      couponCode: pending.couponCode || undefined,
      customerId: pending.customerId,
    });
    if (preview.couponError) throw new Error(preview.couponError);
    if (Math.round(preview.total * 100) !== paidPaise) {
      throw new Error("Order total changed after payment started");
    }

    const order = await createConfirmedOrderService({
      customerId: pending.customerId,
      addressId: pending.addressId,
      couponCode: pending.couponCode || undefined,
      items,
      payment: { method, status: "PAID", transactionRef: paymentId },
      status: "PENDING",
      gatewayOrderId,
      cartItemIds,
    });

    await prisma.pendingCheckout.updateMany({
      where: { id: pending.id },
      data: { status: "CONFIRMED", orderId: order.id },
    });

    return order;
  } catch (err: any) {
    return handleConfirmFailure(
      pending.id,
      gatewayOrderId,
      paymentId,
      paidPaise,
      err.message || "Unknown error",
    );
  }
}

export async function verifyRazorpayPaymentService(
  customerId: string,
  orderId: string,
  paymentId: string,
  signature: string,
) {
  if (!verifySignature(orderId, paymentId, signature)) {
    throw httpError("Payment verification failed — signature mismatch");
  }

  const payment = await razorpay.payments.fetch(paymentId);
  if (payment.order_id !== orderId) {
    throw httpError("Payment does not belong to this order");
  }
  if (payment.status !== "captured") {
    throw httpError(`Payment not captured (status: ${payment.status})`);
  }

  return confirmRazorpayOrder(
    orderId,
    paymentId,
    mapRazorpayMethod(payment.method),
    Number(payment.amount),
    customerId,
  );
}

export async function handleRazorpayWebhookService(
  rawBody: string,
  signature: string,
) {
  if (!verifyWebhookSignature(rawBody, signature)) {
    throw httpError("Invalid webhook signature", 400);
  }

  const payload = JSON.parse(rawBody);
  if (payload.event !== "payment.captured") {
    return { skipped: true, event: payload.event };
  }

  const p = payload.payload.payment.entity;
  return confirmRazorpayOrder(
    p.order_id,
    p.id,
    mapRazorpayMethod(p.method),
    Number(p.amount),
  );
}

// cron se din mein ek baar chalao
export async function cleanupStalePendingCheckouts(days = 7) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return prisma.pendingCheckout.deleteMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
  });
}