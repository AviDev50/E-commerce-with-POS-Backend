import prisma from "../../config/db.js";
import { ReturnStatus, ReturnType, OrderStatus } from "@prisma/client";
import { withFullImageUrls, formatReturnResponse } from "../../utils/returnFormat.js";

const RETURN_WINDOW_DAYS = 7;

const ACTIVE_STATUSES: ReturnStatus[] = [
  ReturnStatus.REQUESTED,
  ReturnStatus.APPROVED,
  ReturnStatus.PICKUP_SCHEDULED,
  ReturnStatus.RECEIVED,
];

const CANCELLABLE_STATUSES: ReturnStatus[] = [ReturnStatus.REQUESTED, ReturnStatus.APPROVED];

interface CreateReturnRequestInput {
  orderItemId: string;
  type: ReturnType;
  reason: string;
  reasonNote?: string;
  images?: string[];
  quantity: number;
  exchangeVariantId?: string;
}

// ==================== CREATE RETURN/EXCHANGE REQUEST ====================
export async function createReturnRequest(customerId: string, data: CreateReturnRequestInput) {
  if (data.quantity <= 0) {
    const error: any = new Error("Quantity must be greater than 0");
    error.statusCode = 400;
    throw error;
  }

const orderItem = await prisma.orderItem.findUnique({
  where: { id: data.orderItemId },
  include: {
    order: true,
    product: { include: { category: true } }, // category chahiye resolve karne ke liye
  },
});

  if (!orderItem) {
    const error: any = new Error("Order item not found");
    error.statusCode = 404;
    throw error;
  }

  if (orderItem.order.customerId !== customerId) {
    const error: any = new Error("This order item does not belong to you");
    error.statusCode = 403;
    throw error;
  }


// Resolution order: product-level explicit setting > category default > true (fallback)
const isReturnable =
  orderItem.product.isReturnable ?? orderItem.product.category?.isReturnable ?? true;

if (!isReturnable) {
  const error: any = new Error("This product is not eligible for return or exchange");
  error.statusCode = 400;
  throw error;
}

  if (orderItem.order.status !== OrderStatus.COMPLETED) {
    const error: any = new Error("Return can only be requested for completed orders");
    error.statusCode = 400;
    throw error;
  }

  if (!orderItem.order.deliveredAt) {
    const error: any = new Error("This order has not been marked as delivered yet");
    error.statusCode = 400;
    throw error;
  }

  const windowEnd = new Date(orderItem.order.deliveredAt);
  windowEnd.setDate(windowEnd.getDate() + RETURN_WINDOW_DAYS);

  if (new Date() > windowEnd) {
    const error: any = new Error(`Return window of ${RETURN_WINDOW_DAYS} days has expired`);
    error.statusCode = 400;
    throw error;
  }

  const activeReturns = await prisma.returnRequest.findMany({
    where: { orderItemId: data.orderItemId, status: { in: ACTIVE_STATUSES } },
    select: { quantity: true },
  });
  const alreadyPendingQty = activeReturns.reduce((sum, r) => sum + r.quantity, 0);
  const availableQty = orderItem.quantity - orderItem.returnedQty - alreadyPendingQty;

  if (data.quantity > availableQty) {
    const error: any = new Error(`Only ${availableQty} unit(s) of this item are eligible for return`);
    error.statusCode = 400;
    throw error;
  }

  if (data.type === ReturnType.EXCHANGE) {
    if (!data.exchangeVariantId) {
      const error: any = new Error("exchangeVariantId is required for exchange requests");
      error.statusCode = 400;
      throw error;
    }

    const exchangeVariant = await prisma.productVariant.findUnique({
      where: { id: data.exchangeVariantId },
    });

    if (!exchangeVariant) {
      const error: any = new Error("Exchange variant not found");
      error.statusCode = 404;
      throw error;
    }

    if (exchangeVariant.productId !== orderItem.productId) {
      const error: any = new Error("Exchange variant must belong to the same product");
      error.statusCode = 400;
      throw error;
    }
  }

  const created = await prisma.returnRequest.create({
    data: {
      orderItemId: data.orderItemId,
      customerId,
      type: data.type,
      reason: data.reason,
      reasonNote: data.reasonNote,
      // string[] aaya hai input mein — DB mein Product/Variant jaisa hi JSON string bana ke store
      images: data.images && data.images.length > 0 ? JSON.stringify(data.images) : null,
      quantity: data.quantity,
      status: ReturnStatus.REQUESTED,
      exchangeVariantId: data.type === ReturnType.EXCHANGE ? data.exchangeVariantId : null,
    },
  });

  return withFullImageUrls(created);
}
// ==================== LIST OWN RETURNS ====================
export async function listMyReturns(customerId: string) {
  const results = await prisma.returnRequest.findMany({
    where: { customerId },
    include: {
      orderItem: {
        include: {
          product: { select: { id: true, name: true, images: true } },
          variant: { select: { id: true, name: true, images: true } },
          order: { select: { id: true, orderNumber: true } },
        },
      },
      exchangeVariant: { select: { id: true, name: true, price: true, images: true } },
      refund: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return results.map(formatReturnResponse);
}

// ==================== GET SINGLE (OWN) ====================
export async function getMyReturnById(customerId: string, id: string) {
  const returnRequest = await prisma.returnRequest.findUnique({
    where: { id },
    include: {
      orderItem: { include: { product: true, variant: true, order: true } },
      exchangeVariant: true,
      exchangeOrder: true,
      refund: true,
    },
  });

  if (!returnRequest || returnRequest.customerId !== customerId) {
    const error: any = new Error("Return request not found");
    error.statusCode = 404;
    throw error;
  }

  return formatReturnResponse(returnRequest);
}

// ==================== CANCEL (OWN) ====================
export async function cancelMyReturn(customerId: string, id: string) {
  const existing = await prisma.returnRequest.findUnique({ where: { id } });

  if (!existing || existing.customerId !== customerId) {
    const error: any = new Error("Return request not found");
    error.statusCode = 404;
    throw error;
  }

  if (!CANCELLABLE_STATUSES.includes(existing.status)) {
    const error: any = new Error(`Cannot cancel a return in ${existing.status} status`);
    error.statusCode = 400;
    throw error;
  }

  const updated = await prisma.returnRequest.update({
    where: { id },
    data: { status: ReturnStatus.CANCELLED },
  });

  return withFullImageUrls(updated);
}