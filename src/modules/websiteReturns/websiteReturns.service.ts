import prisma from "../../config/db.js";
import { ReturnStatus, ReturnType, OrderStatus, OrderChannel, Prisma } from "@prisma/client";
import { withFullImageUrls, formatReturnResponse } from "../../utils/returnFormat.js";
import { fail } from "../../utils/fail.js";
import { DEFAULT_RETURN_WINDOW_DAYS, PENDING_RETURN_STATUSES } from "../../utils/returnPolicy.js";
import { resolveOrderItems } from "../order/order.service.js"; // path apne folder ke hisaab se

// purane RETURN_WINDOW_DAYS aur ACTIVE_STATUSES delete karo, CANCELLABLE_STATUSES rakho
const CANCELLABLE_STATUSES: ReturnStatus[] = [
  ReturnStatus.REQUESTED,
  ReturnStatus.APPROVED,
];

interface CreateReturnRequestInput {
  orderItemId: string;
  type: ReturnType;
  reason: string;
  reasonNote?: string;
  images?: string[];
  quantity: number;
  exchangeProductId?: string;
  exchangeVariantId?: string;
}

// ==================== CREATE RETURN/EXCHANGE REQUEST ====================
export async function createReturnRequest(
  customerId: string,
  data: CreateReturnRequestInput,
) {
  if (!Number.isInteger(data.quantity) || data.quantity <= 0) {
    return fail("Quantity must be a positive whole number");
  }

  const orderItem = await prisma.orderItem.findUnique({
    where: { id: data.orderItemId },
    include: {
      order: true,
      product: { include: { category: true } },
    },
  });

  if (!orderItem) return fail("Order item not found", 404);
  if (orderItem.order.customerId !== customerId) {
    return fail("This order item does not belong to you", 403);
  }
  if (orderItem.order.channel !== OrderChannel.ONLINE) {
    return fail("POS orders can only be returned at the store");
  }

  // product-level setting > category default > true
  const isReturnable =
    orderItem.product.isReturnable ??
    orderItem.product.category?.isReturnable ??
    true;
  if (!isReturnable) {
    return fail("This product is not eligible for return or exchange");
  }

  if (orderItem.order.status !== OrderStatus.COMPLETED) {
    return fail("Return can only be requested for completed orders");
  }

  const deliveredAt =
    orderItem.order.deliveredAt ?? fail("This order has not been marked as delivered yet");

  const settings = await prisma.storeSettings.findFirst();
  const windowDays = settings?.returnWindowDays ?? DEFAULT_RETURN_WINDOW_DAYS;
  const windowEnd = new Date(deliveredAt);
  windowEnd.setDate(windowEnd.getDate() + windowDays);
  if (new Date() > windowEnd) {
    return fail(`Return window of ${windowDays} days has expired`);
  }

  const activeReturns = await prisma.returnRequest.findMany({
    where: { orderItemId: data.orderItemId, status: { in: PENDING_RETURN_STATUSES } },
    select: { quantity: true },
  });
  const alreadyPendingQty = activeReturns.reduce((sum, r) => sum + r.quantity, 0);
  const availableQty = orderItem.quantity - orderItem.returnedQty - alreadyPendingQty;

  if (data.quantity > availableQty) {
    return fail(`Only ${availableQty} unit(s) of this item are eligible for return`);
  }

  const isExchange = data.type === ReturnType.EXCHANGE;

  if (isExchange) {
    if (!data.exchangeProductId) {
      return fail("exchangeProductId is required for an exchange");
    }
    try {
      const [resolved] = await resolveOrderItems(
        prisma as unknown as Prisma.TransactionClient,
        [{ productId: data.exchangeProductId, variantId: data.exchangeVariantId, quantity: data.quantity }],
      );
      const stock = resolved.variantId
        ? (await prisma.productVariant.findUnique({ where: { id: resolved.variantId }, select: { stock: true } }))?.stock
        : (await prisma.product.findUnique({ where: { id: resolved.productId }, select: { stock: true } }))?.stock;
      if ((stock ?? 0) < data.quantity) fail("Exchange item is out of stock");
    } catch (e: any) {
      e.statusCode = e.statusCode ?? 400; // resolveOrderItems plain Error throw karta hai
      throw e;
    }
  }

  const created = await prisma.returnRequest.create({
    data: {
      orderItemId: data.orderItemId,
      customerId,
      type: data.type,
      reason: data.reason,
      reasonNote: data.reasonNote,
      images:
        data.images && data.images.length > 0 ? JSON.stringify(data.images) : null,
      quantity: data.quantity,
      status: ReturnStatus.REQUESTED,
      exchangeProductId: isExchange ? data.exchangeProductId : null,
      exchangeVariantId: isExchange ? data.exchangeVariantId : null,
    },
  });

  return withFullImageUrls(created);
}
// ==================== LIST OWN RETURNS ====================exchangeProduct: { select: { id: true, name: true, images: true } }
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
      exchangeVariant: {
        select: { id: true, name: true, price: true, images: true },
      },
      exchangeProduct: { select: { id: true, name: true, images: true } },
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
    const error: any = new Error(
      `Cannot cancel a return in ${existing.status} status`,
    );
    error.statusCode = 400;
    throw error;
  }

  const updated = await prisma.returnRequest.update({
    where: { id },
    data: { status: ReturnStatus.CANCELLED },
  });

  return withFullImageUrls(updated);
}
