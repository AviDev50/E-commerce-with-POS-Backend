import prisma from "../../config/db.js";
import {
  ReturnStatus,
  ReturnType,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  RefundStatus,
  OrderChannel,
} from "@prisma/client";
import { formatReturnResponse } from "../../utils/returnFormat.js";

// Explicit ReturnStatus[] typing — warna TS inline array literal ko
// narrow ("REQUESTED"|"APPROVED")[] type de deta hai aur .includes() mismatch deta hai
const REJECTABLE_STATUSES: ReturnStatus[] = [ReturnStatus.REQUESTED, ReturnStatus.APPROVED];
const RECEIVABLE_STATUSES: ReturnStatus[] = [ReturnStatus.APPROVED, ReturnStatus.PICKUP_SCHEDULED];

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
            order: { select: { id: true, orderNumber: true, deliveredAt: true } },
          },
        },
        customer: { select: { id: true, name: true, phone: true } },
        exchangeVariant: { select: { id: true, name: true, price: true, images: true } },
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
    const error: any = new Error(`Cannot approve a return in ${existing.status} status`);
    error.statusCode = 400;
    throw error;
  }

  return prisma.returnRequest.update({
    where: { id },
    data: { status: ReturnStatus.APPROVED, approvedById: adminId },
  });
}

// ==================== REJECT ====================
export async function rejectReturn(id: string, adminId: string, reasonNote?: string) {
  const existing = await prisma.returnRequest.findUnique({ where: { id } });
  if (!existing) {
    const error: any = new Error("Return request not found");
    error.statusCode = 404;
    throw error;
  }

 if (!REJECTABLE_STATUSES.includes(existing.status)) {
    const error: any = new Error(`Cannot reject a return in ${existing.status} status`);
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
    const error: any = new Error("Return must be approved before scheduling pickup");
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
      const error: any = new Error(`Cannot mark received from ${existing.status} status`);
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
  const existing = await prisma.returnRequest.findUnique({
    where: { id },
    include: { orderItem: true, refund: true },
  });

  if (!existing) {
    const error: any = new Error("Return request not found");
    error.statusCode = 404;
    throw error;
  }

  if (existing.type !== ReturnType.RETURN) {
    const error: any = new Error("This is an exchange request, use the exchange endpoint");
    error.statusCode = 400;
    throw error;
  }

  if (existing.status !== ReturnStatus.RECEIVED) {
    const error: any = new Error("Item must be received before refund can be processed");
    error.statusCode = 400;
    throw error;
  }

  if (existing.refund) {
    const error: any = new Error("Refund already processed for this return");
    error.statusCode = 400;
    throw error;
  }

  const { orderItem } = existing;
  const perUnitTotal = (Number(orderItem.subtotal) + Number(orderItem.taxAmount)) / orderItem.quantity;
  const refundAmount = Number((perUnitTotal * existing.quantity).toFixed(2));

  return prisma.$transaction(async (tx) => {
    const refund = await tx.refund.create({
      data: {
        orderId: orderItem.orderId,
        amount: refundAmount,
        reason: existing.reason,
        status: RefundStatus.COMPLETED, // COD hai — actual cash/transfer admin manually karta hai bahar
        processedById: adminId,
        returnRequestId: existing.id,
      },
    });

    await tx.returnRequest.update({ where: { id }, data: { status: ReturnStatus.REFUNDED } });

    return refund;
  });
}

// ==================== PROCESS EXCHANGE (type = EXCHANGE) ====================
export async function processExchange(id: string, _adminId: string) {
  const existing = await prisma.returnRequest.findUnique({
    where: { id },
    include: { orderItem: { include: { order: true } } },
  });

  if (!existing) {
    const error: any = new Error("Return request not found");
    error.statusCode = 404;
    throw error;
  }

  if (existing.type !== ReturnType.EXCHANGE) {
    const error: any = new Error("This is a return request, use the refund endpoint");
    error.statusCode = 400;
    throw error;
  }

  if (existing.status !== ReturnStatus.RECEIVED) {
    const error: any = new Error("Item must be received before exchange can be processed");
    error.statusCode = 400;
    throw error;
  }

  if (!existing.exchangeVariantId) {
    const error: any = new Error("No exchange variant specified on this request");
    error.statusCode = 400;
    throw error;
  }

  const newVariant = await prisma.productVariant.findUnique({ where: { id: existing.exchangeVariantId } });

  if (!newVariant) {
    const error: any = new Error("Exchange variant not found");
    error.statusCode = 404;
    throw error;
  }

  if (newVariant.stock < existing.quantity) {
    const error: any = new Error("Exchange variant is out of stock");
    error.statusCode = 400;
    throw error;
  }

  const { orderItem } = existing;
  const priceDiffPerUnit = Number(newVariant.price) - Number(orderItem.price);
  const totalPriceDiff = Number((priceDiffPerUnit * existing.quantity).toFixed(2));

  return prisma.$transaction(async (tx) => {
    await tx.productVariant.update({
      where: { id: newVariant.id },
      data: { stock: { decrement: existing.quantity } },
    });

    const subtotal = Number((Number(newVariant.price) * existing.quantity).toFixed(2));

    const exchangeOrder = await tx.order.create({
      data: {
        orderNumber: `EXC-${Date.now()}`,
        channel: OrderChannel.ONLINE,
        status: OrderStatus.PROCESSING,
        customerId: existing.customerId,
        addressId: orderItem.order.addressId,
        subtotal,
        tax: 0, // V1: naye variant pe tax dobara calculate nahi kar rahe, future scope
        discount: 0,
        total: subtotal,
        orderItems: {
          create: {
            productId: newVariant.productId,
            variantId: newVariant.id,
            quantity: existing.quantity,
            price: newVariant.price,
            subtotal,
          },
        },
        payment: {
          create: {
            method: PaymentMethod.COD,
            // price zyada hai to delivery pe extra COD lena hai, kam/same hai to PAID maan lo (V1 simplification)
            status: totalPriceDiff > 0 ? PaymentStatus.PENDING : PaymentStatus.PAID,
            amount: totalPriceDiff > 0 ? totalPriceDiff : 0,
          },
        },
      },
    });

    await tx.returnRequest.update({
      where: { id },
      data: { status: ReturnStatus.EXCHANGED, exchangeOrderId: exchangeOrder.id },
    });

    return exchangeOrder;
  });
}