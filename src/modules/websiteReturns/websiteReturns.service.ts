import prisma from "../../config/db.js";
import {
  ReturnStatus,
  ReturnType,
  OrderStatus,
  OrderChannel,
  Prisma,
  RefundDestination,
  RefundStatus,
  PaymentMethod,
} from "@prisma/client";
import {
  withFullImageUrls,
  formatReturnResponse,
} from "../../utils/returnFormat.js";
import { fail } from "../../utils/fail.js";
import {
  DEFAULT_RETURN_WINDOW_DAYS,
  PENDING_RETURN_STATUSES,
} from "../../utils/returnPolicy.js";
import { resolveOrderItems } from "../order/order.service.js";
import { maskUpi } from "../../utils/maskUpi.js";

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
  refundTo?: RefundDestination;
  payoutMethodId?: string;
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
    orderItem.order.deliveredAt ??
    fail("This order has not been marked as delivered yet");

  const settings = await prisma.storeSettings.findFirst();
  const windowDays = settings?.returnWindowDays ?? DEFAULT_RETURN_WINDOW_DAYS;
  const windowEnd = new Date(deliveredAt);
  windowEnd.setDate(windowEnd.getDate() + windowDays);
  if (new Date() > windowEnd) {
    return fail(`Return window of ${windowDays} days has expired`);
  }

  const activeReturns = await prisma.returnRequest.findMany({
    where: {
      orderItemId: data.orderItemId,
      status: { in: PENDING_RETURN_STATUSES },
    },
    select: { quantity: true },
  });
  const alreadyPendingQty = activeReturns.reduce(
    (sum, r) => sum + r.quantity,
    0,
  );
  const availableQty =
    orderItem.quantity - orderItem.returnedQty - alreadyPendingQty;

  if (data.quantity > availableQty) {
    return fail(
      `Only ${availableQty} unit(s) of this item are eligible for return`,
    );
  }

  // default nahi: customer ko Wallet ya UPI chunna hi hoga (exchange mein bhi, kyunki diff pehle se pata nahi)
if (!data.refundTo || !Object.values(RefundDestination).includes(data.refundTo)) {
  return fail("refundTo is required (WALLET or UPI)");
}

const paidViaWallet =
  (await prisma.payment.count({
    where: { orderId: orderItem.orderId, method: PaymentMethod.WALLET },
  })) > 0;
if (paidViaWallet && data.refundTo !== RefundDestination.WALLET) {
  return fail("This order was paid via wallet, so the refund can only go to your wallet");
}

let payoutMethodId: string | null = null;
if (data.refundTo === RefundDestination.UPI) {
  if (!data.payoutMethodId) return fail("payoutMethodId is required when refundTo is UPI");
  const method = await prisma.payoutMethod.findUnique({ where: { id: data.payoutMethodId } });
  if (!method || method.customerId !== customerId || !method.isActive) {
    return fail("Payout method not found", 404);
  }
  payoutMethodId = method.id;
}

  const isExchange = data.type === ReturnType.EXCHANGE;

  if (isExchange) {
    if (!data.exchangeProductId) {
      return fail("exchangeProductId is required for an exchange");
    }
    try {
      const [resolved] = await resolveOrderItems(
        prisma as unknown as Prisma.TransactionClient,
        [
          {
            productId: data.exchangeProductId,
            variantId: data.exchangeVariantId,
            quantity: data.quantity,
          },
        ],
      );
      const stock = resolved.variantId
        ? (
            await prisma.productVariant.findUnique({
              where: { id: resolved.variantId },
              select: { stock: true },
            })
          )?.stock
        : (
            await prisma.product.findUnique({
              where: { id: resolved.productId },
              select: { stock: true },
            })
          )?.stock;
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
        data.images && data.images.length > 0
          ? JSON.stringify(data.images)
          : null,
      quantity: data.quantity,
      status: ReturnStatus.REQUESTED,
      exchangeProductId: isExchange ? data.exchangeProductId : null,
      exchangeVariantId: isExchange ? data.exchangeVariantId : null,
      refundTo: data.refundTo,
payoutMethodId,
    },
  });

  return withFullImageUrls(created);
}
const MY_REFUND_SELECT = {
  id: true, amount: true, method: true, status: true,
  transactionRef: true, failureReason: true, paidAt: true, createdAt: true,
};

function formatMyReturn(r: any) {
  const { payoutMethod, ...rest } = formatReturnResponse(r);
  return {
    ...rest,
    payoutMethod: payoutMethod
      ? { id: payoutMethod.id, type: payoutMethod.type, label: payoutMethod.label, upiMasked: maskUpi(payoutMethod.upiId) }
      : null,
  };
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
      exchangeProduct: { select: { id: true, name: true, images: true } },
      payoutMethod: { select: { id: true, type: true, label: true, upiId: true } },
      refund: { select: MY_REFUND_SELECT },
    },
    orderBy: { createdAt: "desc" },
  });
  return results.map(formatMyReturn);
}

// ==================== GET SINGLE (OWN) ====================
export async function getMyReturnById(customerId: string, id: string) {
  const returnRequest = await prisma.returnRequest.findUnique({
    where: { id },
    include: {
      orderItem: { include: { product: true, variant: true, order: true } },
      exchangeVariant: true,
      exchangeProduct: { select: { id: true, name: true, images: true } },
      exchangeOrder: true,
      payoutMethod: { select: { id: true, type: true, label: true, upiId: true } },
      refund: { select: MY_REFUND_SELECT },
    },
  });

  if (!returnRequest || returnRequest.customerId !== customerId) {
    return fail("Return request not found", 404);
  }
  return formatMyReturn(returnRequest);
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

export async function changePayoutMethodAfterFailure(
  customerId: string,
  returnRequestId: string,
  payoutMethodId: string,
) {
  if (!payoutMethodId) return fail("payoutMethodId is required");

  return prisma.$transaction(async (tx) => {
    const rr = await tx.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: { refund: true },
    });
    if (!rr || rr.customerId !== customerId) return fail("Return request not found", 404);

    const refund = rr.refund;
    if (!refund || refund.status !== RefundStatus.FAILED || !refund.payoutMethodId) {
      return fail("Payout details can only be changed after a failed UPI payout");
    }

    const method = await tx.payoutMethod.findUnique({ where: { id: payoutMethodId } });
    if (!method || method.customerId !== customerId || !method.isActive) {
      return fail("Payout method not found", 404);
    }

    const updated = await tx.refund.updateMany({
      where: { id: refund.id, status: RefundStatus.FAILED },
      data: { payoutMethodId: method.id, status: RefundStatus.PENDING, failureReason: null },
    });
    if (updated.count === 0) return fail("Payout was just updated. Please refresh.", 409);

    await tx.returnRequest.update({
      where: { id: returnRequestId },
      data: { payoutMethodId: method.id },
    });

    return {
      returnRequestId,
      refundStatus: RefundStatus.PENDING,
      payoutMethod: { id: method.id, label: method.label, upiMasked: maskUpi(method.upiId) },
    };
  });
}