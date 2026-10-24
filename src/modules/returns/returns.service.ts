import prisma from "../../config/db.js";
import {
  ReturnStatus,
  ReturnType,
  OrderStatus,
  PaymentStatus,
  RefundStatus,
  OrderChannel,
  Prisma,
  PaymentMethod,
  ExchangeSettlement,
  RefundDestination,
} from "@prisma/client";
import { fail } from "../../utils/fail.js";
import { formatReturnResponse } from "../../utils/returnFormat.js";
import { generateOrderNumber } from "../../utils/orderNumberGenerator.js";
import { creditWalletTx } from "../wallet/wallet.service.js";
import {
  paidValueForUnits,
  quoteExchange,
  deductStock,
} from "../order/order.service.js";

// Explicit ReturnStatus[] typing — warna TS inline array literal ko
// narrow ("REQUESTED"|"APPROVED")[] type de deta hai aur .includes() mismatch deta hai
const REJECTABLE_STATUSES: ReturnStatus[] = [
  ReturnStatus.REQUESTED,
  ReturnStatus.APPROVED,
];
const RECEIVABLE_STATUSES: ReturnStatus[] = [
  ReturnStatus.APPROVED,
  ReturnStatus.PICKUP_SCHEDULED,
];

interface ListReturnsFilters {
  status?: ReturnStatus;
  type?: ReturnType;
  page?: number;
  limit?: number;
}

export async function listReturns(filters: ListReturnsFilters) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const limit = filters.limit && filters.limit > 0 ? filters.limit : 20;

  const where: any = {};
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;

  const [items, total] = await Promise.all([
    prisma.returnRequest.findMany({
      where,
      include: {
        orderItem: {
          include: {
            product: { select: { id: true, name: true, images: true } },
            variant: { select: { id: true, name: true, images: true } },
            order: {
              select: { id: true, orderNumber: true, deliveredAt: true },
            },
          },
        },
        customer: { select: { id: true, name: true, phone: true } },
        exchangeVariant: {
          select: { id: true, name: true, price: true, images: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.returnRequest.count({ where }),
  ]);

  return {
    items: items.map(formatReturnResponse),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getReturnById(id: string) {
  const returnRequest = await prisma.returnRequest.findUnique({
    where: { id },
    include: {
      orderItem: { include: { product: true, variant: true, order: true } },
      customer: { select: { id: true, name: true, phone: true } },
      exchangeVariant: true,
      exchangeOrder: true,
      refund: true,
      payoutMethod: true,
    },
  });

  if (!returnRequest) {
    const error: any = new Error("Return request not found");
    error.statusCode = 404;
    throw error;
  }

  return formatReturnResponse(returnRequest);
}

// ==================== APPROVE ====================
export async function approveReturn(id: string, adminId: string) {
  const existing = await prisma.returnRequest.findUnique({ where: { id } });
  if (!existing) {
    const error: any = new Error("Return request not found");
    error.statusCode = 404;
    throw error;
  }

  if (existing.status !== ReturnStatus.REQUESTED) {
    const error: any = new Error(
      `Cannot approve a return in ${existing.status} status`,
    );
    error.statusCode = 400;
    throw error;
  }

  return prisma.returnRequest.update({
    where: { id },
    data: { status: ReturnStatus.APPROVED, approvedById: adminId },
  });
}

// ==================== REJECT ====================
export async function rejectReturn(
  id: string,
  adminId: string,
  reasonNote?: string,
) {
  const existing = await prisma.returnRequest.findUnique({ where: { id } });
  if (!existing) {
    const error: any = new Error("Return request not found");
    error.statusCode = 404;
    throw error;
  }

  if (!REJECTABLE_STATUSES.includes(existing.status)) {
    const error: any = new Error(
      `Cannot reject a return in ${existing.status} status`,
    );
    error.statusCode = 400;
    throw error;
  }

  return prisma.returnRequest.update({
    where: { id },
    data: {
      status: ReturnStatus.REJECTED,
      approvedById: adminId,
      reasonNote: reasonNote ?? existing.reasonNote,
    },
  });
}

// ==================== SCHEDULE PICKUP ====================
export async function schedulePickup(id: string) {
  const existing = await prisma.returnRequest.findUnique({ where: { id } });
  if (!existing) {
    const error: any = new Error("Return request not found");
    error.statusCode = 404;
    throw error;
  }

  if (existing.status !== ReturnStatus.APPROVED) {
    const error: any = new Error(
      "Return must be approved before scheduling pickup",
    );
    error.statusCode = 400;
    throw error;
  }

  return prisma.returnRequest.update({
    where: { id },
    data: { status: ReturnStatus.PICKUP_SCHEDULED },
  });
}

// ==================== MARK RECEIVED (RESTOCK YAHI HOTA HAI) ====================
export async function markReceived(id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.returnRequest.findUnique({
      where: { id },
      include: { orderItem: true },
    });

    if (!existing) {
      const error: any = new Error("Return request not found");
      error.statusCode = 404;
      throw error;
    }

    if (!RECEIVABLE_STATUSES.includes(existing.status)) {
      const error: any = new Error(
        `Cannot mark received from ${existing.status} status`,
      );
      error.statusCode = 400;
      throw error;
    }

    // variantId hai to variant stock badhao, warna product stock
    if (existing.orderItem.variantId) {
      await tx.productVariant.update({
        where: { id: existing.orderItem.variantId },
        data: { stock: { increment: existing.quantity } },
      });
    } else {
      await tx.product.update({
        where: { id: existing.orderItem.productId },
        data: { stock: { increment: existing.quantity } },
      });
    }

    await tx.orderItem.update({
      where: { id: existing.orderItemId },
      data: { returnedQty: { increment: existing.quantity } },
    });

    return tx.returnRequest.update({
      where: { id },
      data: { status: ReturnStatus.RECEIVED },
    });
  });
}

// ==================== PROCESS REFUND (type = RETURN, COD manual) ====================
export async function processRefund(id: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.returnRequest.findUnique({
      where: { id },
      include: { orderItem: { include: { order: true } }, refund: true },
    });
    if (!existing) return fail("Return request not found", 404);
    if (existing.type !== ReturnType.RETURN)
      return fail("This is an exchange request, use the exchange endpoint");
    if (existing.status !== ReturnStatus.RECEIVED)
      return fail("Item must be received before refund can be processed");
    if (existing.refund)
      return fail("Refund already processed for this return");

    const { orderItem } = existing;
    const amount = paidValueForUnits(
      orderItem,
      orderItem.order,
      existing.quantity,
    );

    // UPI: refund PENDING banta hai, admin manually bhejta hai; request tab REFUNDED hogi jab payout COMPLETED ho
    if (existing.refundTo === RefundDestination.UPI) {
      if (!existing.payoutMethodId)
        return fail("Customer has not provided a payout method");
      const refund = await tx.refund.create({
        data: {
          orderId: orderItem.orderId,
          amount,
          method: PaymentMethod.UPI,
          reason: existing.reason,
          status: RefundStatus.PENDING,
          processedById: adminId,
          returnRequestId: existing.id,
          payoutMethodId: existing.payoutMethodId,
        },
      });
      await tx.returnRequest.update({
        where: { id },
        data: {
          originalValue: amount,
          settlement: ExchangeSettlement.UPI_TRANSFER,
        },
      });
      return refund;
    }

    // WALLET (aur purani requests jinme refundTo null hai)
    const refund = await tx.refund.create({
      data: {
        orderId: orderItem.orderId,
        amount,
        method: PaymentMethod.WALLET,
        reason: existing.reason,
        status: RefundStatus.COMPLETED,
        processedById: adminId,
        returnRequestId: existing.id,
      },
    });
    await creditWalletTx(tx, {
      customerId: existing.customerId,
      amount,
      reason: `Return refund (${orderItem.order.orderNumber})`,
      returnRequestId: existing.id,
    });
    await tx.returnRequest.update({
      where: { id },
      data: {
        status: ReturnStatus.REFUNDED,
        originalValue: amount,
        settlement: ExchangeSettlement.WALLET_CREDIT,
      },
    });
    return refund;
  });
}

// ==================== PROCESS EXCHANGE (type = EXCHANGE) ====================
export async function processExchange(id: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.returnRequest.findUnique({
      where: { id },
      include: {
        orderItem: { include: { order: { include: { address: true } } } },
      },
    });
    if (!existing) return fail("Return request not found", 404);
    if (existing.type !== ReturnType.EXCHANGE)
      return fail("This is a return request, use the refund endpoint");
    if (existing.status !== ReturnStatus.RECEIVED)
      return fail("Item must be received before exchange can be processed");

    const { orderItem } = existing;
    const order = orderItem.order;
    const address = order.address ?? fail("Order has no shipping address");
    const settings = await tx.storeSettings.findFirst();

    const quote = await quoteExchange(tx, {
      originalItem: orderItem,
      order,
      quantity: existing.quantity,
      newProductId: existing.exchangeProductId ?? orderItem.productId, // purani requests: same product
      newVariantId: existing.exchangeVariantId ?? undefined,
      dest: { country: address.country, state: address.state },
      origin: {
        country: settings?.country ?? null,
        state: settings?.state ?? null,
      },
    });
    await deductStock(tx, quote.resolvedNewItems);

    const { priceDiff } = quote;
    const orderNumber = await generateOrderNumber(tx);

    const exchangeOrder = await tx.order.create({
      data: {
        orderNumber,
        channel: OrderChannel.ONLINE,
        status: OrderStatus.PROCESSING,
        isExchange: true,
        customerId: existing.customerId,
        addressId: order.addressId,
        subtotal: quote.newSubtotal,
        tax: quote.newTax,
        discount: 0,
        total: quote.newItemTotal,
        orderItems: {
          create: quote.itemsWithTax.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
            price: i.price,
            subtotal: i.subtotal,
            taxAmount: i.taxAmount,
            taxBreakdown: i.taxBreakdown as unknown as Prisma.InputJsonValue,
          })),
        },
        // mehenga item: diff delivery par COD se
        payments:
          priceDiff > 0
            ? {
                create: [
                  {
                    method: PaymentMethod.COD,
                    status: PaymentStatus.PENDING,
                    amount: priceDiff,
                  },
                ],
              }
            : undefined,
      },
    });

    let settlement: ExchangeSettlement = ExchangeSettlement.NONE;
    if (priceDiff > 0) settlement = ExchangeSettlement.COLLECT_ON_DELIVERY;

    if (priceDiff < 0) {
      const amount = Math.abs(priceDiff);

      if (existing.refundTo === RefundDestination.UPI) {
        if (!existing.payoutMethodId)
          return fail("Customer has not provided a payout method");
        await tx.refund.create({
          data: {
            orderId: orderItem.orderId,
            amount,
            method: PaymentMethod.UPI,
            reason: `Exchange price difference (${orderNumber})`,
            status: RefundStatus.PENDING,
            processedById: adminId,
            returnRequestId: id,
            payoutMethodId: existing.payoutMethodId,
          },
        });
        settlement = ExchangeSettlement.UPI_TRANSFER;
      } else {
        await tx.refund.create({
          data: {
            orderId: orderItem.orderId,
            amount,
            method: PaymentMethod.WALLET,
            reason: `Exchange price difference credited to wallet (${orderNumber})`,
            status: RefundStatus.COMPLETED,
            processedById: adminId,
            returnRequestId: id,
          },
        });
        await creditWalletTx(tx, {
          customerId: existing.customerId,
          amount,
          reason: `Exchange difference (${orderNumber})`,
          returnRequestId: id,
        });
        settlement = ExchangeSettlement.WALLET_CREDIT;
      }
    }
    await tx.returnRequest.update({
      where: { id },
      data: {
        status: ReturnStatus.EXCHANGED,
        exchangeOrderId: exchangeOrder.id,
        approvedById: adminId,
        originalValue: quote.originalValue,
        newValue: quote.newItemTotal,
        priceDiff,
        settlement,
      },
    });

    return exchangeOrder;
  });
}

export async function listPayouts(filters: {
  status?: RefundStatus;
  page?: number;
  limit?: number;
}) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const limit = filters.limit && filters.limit > 0 ? filters.limit : 20;

  // payoutMethodId sirf is feature ke refunds par hota hai (POS counter refunds bahar)
  const where: Prisma.RefundWhereInput = {
    payoutMethodId: { not: null },
    status: filters.status ?? {
      in: [RefundStatus.PENDING, RefundStatus.FAILED],
    },
  };

  const [rows, total] = await Promise.all([
    prisma.refund.findMany({
      where,
      include: {
        payoutMethod: { select: { upiId: true, label: true } },
        returnRequest: {
          select: {
            id: true,
            type: true,
            reason: true,
            customer: { select: { name: true, phone: true } },
            orderItem: {
              select: {
                product: { select: { name: true } },
                order: { select: { orderNumber: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" }, // purana pehle
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.refund.count({ where }),
  ]);

  return {
    items: rows.map((r) => ({
      refundId: r.id,
      returnRequestId: r.returnRequest?.id ?? null,
      type: r.returnRequest?.type ?? null,
      status: r.status,
      amount: Number(r.amount),
      upiId: r.payoutMethod?.upiId ?? null, // admin ko poori
      upiLabel: r.payoutMethod?.label ?? null,
      customerName: r.returnRequest?.customer.name ?? null,
      customerPhone: r.returnRequest?.customer.phone ?? null,
      orderNumber: r.returnRequest?.orderItem.order.orderNumber ?? null,
      productName: r.returnRequest?.orderItem.product.name ?? null,
      transactionRef: r.transactionRef,
      failureReason: r.failureReason,
      paidAt: r.paidAt,
      createdAt: r.createdAt,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function completePayout(
  refundId: string,
  adminId: string,
  transactionRef: string,
) {
  const ref = String(transactionRef ?? "").trim();
  if (ref.length < 6)
    return fail("transactionRef (UTR) is required, at least 6 characters");

  return prisma.$transaction(async (tx) => {
    const marked = await tx.refund.updateMany({
      where: {
        id: refundId,
        status: RefundStatus.PENDING,
        payoutMethodId: { not: null },
      },
      data: {
        status: RefundStatus.COMPLETED,
        transactionRef: ref,
        paidAt: new Date(),
        processedById: adminId,
        failureReason: null,
      },
    });
    if (marked.count === 0)
      return fail("Payout not found or not in PENDING status", 404);

    const refund = await tx.refund.findUnique({
      where: { id: refundId },
      include: { returnRequest: { select: { id: true, type: true } } },
    });

    // RETURN tab REFUNDED hoti hai jab paisa chala jaye (EXCHANGE pehle hi EXCHANGED hai)
    if (refund?.returnRequest?.type === ReturnType.RETURN) {
      await tx.returnRequest.update({
        where: { id: refund.returnRequest.id },
        data: { status: ReturnStatus.REFUNDED },
      });
    }
    return refund;
  });
}

export async function failPayout(
  refundId: string,
  adminId: string,
  reason: string,
) {
  const failureReason = String(reason ?? "").trim();
  if (!failureReason) return fail("reason is required");

  const marked = await prisma.refund.updateMany({
    where: {
      id: refundId,
      status: RefundStatus.PENDING,
      payoutMethodId: { not: null },
    },
    data: {
      status: RefundStatus.FAILED,
      failureReason,
      processedById: adminId,
    },
  });
  if (marked.count === 0)
    return fail("Payout not found or not in PENDING status", 404);

  return prisma.refund.findUnique({ where: { id: refundId } });
}
