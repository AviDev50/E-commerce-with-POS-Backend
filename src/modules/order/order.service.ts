import prisma from "../../config/db.js";
import { Prisma, PaymentMethod, GstType } from "@prisma/client";
import { calculateTaxBreakdown } from "../../utils/taxCalculator.js";
import { generateOrderNumber } from "../../utils/orderNumberGenerator.js";
import { computeCouponDiscount } from "../../utils/couponValidator.js";

interface OrderItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

interface CreatePosOrderInput {
  items: OrderItemInput[];
  customerId?: string;
  couponCode?: string;
  paymentMethod: PaymentMethod;
  createdById: string;
}

interface CreateOnlineOrderInput {
  items: OrderItemInput[];
  addressId: string;
  couponCode?: string;
  customerId: string;
  cartItemIds?: string[];
  paymentMethod: PaymentMethod;
}

interface ResolvedItem {
  productId: string;
  productName: string;
  variantId?: string;
  quantity: number;
  price: number;
  taxRatePercent: number;
}

// ==================== SHARED HELPERS ====================

async function resolveOrderItems(
  tx: Prisma.TransactionClient,
  items: OrderItemInput[],
): Promise<ResolvedItem[]> {
  const resolved: ResolvedItem[] = [];

  for (const item of items) {
    if (item.quantity <= 0) {
      throw new Error("Quantity must be greater than 0");
    }

    const product = await tx.product.findUnique({
      where: { id: item.productId },
      include: { category: true },
    });

    if (!product || !product.isActive) {
      throw new Error(`Product not found or inactive: ${item.productId}`);
    }

    let price: number;

    if (item.variantId) {
      const variant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
      });
      if (!variant || variant.productId !== item.productId) {
        throw new Error(`Variant not found for product: ${product.name}`);
      }
      price = Number(variant.price);
    } else {
      price = Number(product.price);
    }

    const taxRatePercent = product.taxRate
      ? Number(product.taxRate)
      : product.category?.taxRate
        ? Number(product.category.taxRate)
        : 0;

    resolved.push({
      productId: item.productId,
      productName: product.name,
      variantId: item.variantId,
      quantity: item.quantity,
      price,
      taxRatePercent,
    });
  }

  return resolved;
}

// Atomic check-and-decrement — race condition safe (Postgres row-lock via UPDATE)
async function deductStock(
  tx: Prisma.TransactionClient,
  items: ResolvedItem[],
) {
  for (const item of items) {
    if (item.variantId) {
      const result = await tx.productVariant.updateMany({
        where: { id: item.variantId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (result.count === 0) {
        throw new Error(`Insufficient stock for: ${item.productName}`);
      }
    } else {
      const result = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (result.count === 0) {
        throw new Error(`Insufficient stock for: ${item.productName}`);
      }
    }
  }
}

async function restoreStock(
  tx: Prisma.TransactionClient,
  orderItems: {
    productId: string;
    variantId: string | null;
    quantity: number;
  }[],
) {
  for (const item of orderItems) {
    if (item.variantId) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    } else {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }
}

async function applyCoupon(
  tx: Prisma.TransactionClient,
  couponCode: string,
  subtotal: number,
) {
  const coupon = await tx.coupon.findUnique({
    where: { code: couponCode.toUpperCase().trim() },
  });

  if (!coupon) {
    throw new Error("Invalid coupon code");
  }

  const discount = computeCouponDiscount(coupon, subtotal);

  await tx.coupon.update({
    where: { id: coupon.id },
    data: { usedCount: { increment: 1 } },
  });

  return { couponId: coupon.id, discount };
}

function buildItemsWithTax(items: ResolvedItem[], gstType: GstType) {
  return items.map((item) => {
    const itemSubtotal = item.price * item.quantity;
    const breakdown = calculateTaxBreakdown(
      itemSubtotal,
      item.taxRatePercent,
      gstType,
    );

    return {
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      price: item.price,
      subtotal: itemSubtotal,
      taxRate: item.taxRatePercent,
      taxAmount: breakdown.taxAmount,
      cgstAmount: breakdown.cgstAmount,
      sgstAmount: breakdown.sgstAmount,
      igstAmount: breakdown.igstAmount,
    };
  });
}

// ==================== POS ORDER ====================

export async function createPosOrderService(data: CreatePosOrderInput) {
  return prisma.$transaction(async (tx) => {
    const resolvedItems = await resolveOrderItems(tx, data.items);
    await deductStock(tx, resolvedItems);

    const subtotal = resolvedItems.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0,
    );

    let discount = 0;
    let couponId: string | undefined;
    if (data.couponCode) {
      const couponResult = await applyCoupon(tx, data.couponCode, subtotal);
      discount = couponResult.discount;
      couponId = couponResult.couponId;
    }

    const gstType: GstType = "INTRA_STATE"; // POS = walk-in, hamesha same state

    const itemsWithTax = buildItemsWithTax(resolvedItems, gstType);
    const totalTax = itemsWithTax.reduce((sum, i) => sum + i.taxAmount, 0);
    const total = subtotal - discount + totalTax;

    const orderNumber = await generateOrderNumber(tx);

    return tx.order.create({
      data: {
        orderNumber,
        channel: "POS",
        status: "COMPLETED",
        gstType,
        customerId: data.customerId,
        createdById: data.createdById,
        couponId,
        subtotal,
        tax: totalTax,
        discount,
        total,
        orderItems: { create: itemsWithTax },
        payment: {
          create: { method: data.paymentMethod, status: "PAID", amount: total },
        },
      },
      include: { orderItems: true, payment: true },
    });
  });
}

// ==================== ONLINE ORDER ====================

export async function createOnlineOrderService(data: CreateOnlineOrderInput) {
  if (data.paymentMethod !== "COD") {
    throw new Error("Only COD payment is supported at the moment");
  }
  return prisma.$transaction(async (tx) => {
    const address = await tx.address.findUnique({
      where: { id: data.addressId },
    });
    if (!address || address.customerId !== data.customerId) {
      throw new Error("Address not found");
    }

    const storeSettings = await tx.storeSettings.findFirst();
    const storeState = storeSettings?.state;

    const gstType: GstType =
      storeState && address.state.toLowerCase() === storeState.toLowerCase()
        ? "INTRA_STATE"
        : "INTER_STATE";

    const resolvedItems = await resolveOrderItems(tx, data.items);
    await deductStock(tx, resolvedItems);

    const subtotal = resolvedItems.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0,
    );

    let discount = 0;
    let couponId: string | undefined;
    if (data.couponCode) {
      const couponResult = await applyCoupon(tx, data.couponCode, subtotal);
      discount = couponResult.discount;
      couponId = couponResult.couponId;
    }

    const itemsWithTax = buildItemsWithTax(resolvedItems, gstType);
    const totalTax = itemsWithTax.reduce((sum, i) => sum + i.taxAmount, 0);
    const total = subtotal - discount + totalTax;

    const orderNumber = await generateOrderNumber(tx);

const order = await tx.order.create({
      data: {
        orderNumber,
        channel: "ONLINE",
        status: "PENDING",
        gstType,
        customerId: data.customerId,
        addressId: data.addressId,
        couponId,
        subtotal,
        tax: totalTax,
        discount,
        total,
        orderItems: { create: itemsWithTax },
        payment: { create: { method: data.paymentMethod, status: "PENDING", amount: total } },
      },
      include: { orderItems: true, payment: true },
    });

    if (data.cartItemIds && data.cartItemIds.length > 0) {
      await tx.cartItem.deleteMany({
        where: { id: { in: data.cartItemIds }, cart: { customerId: data.customerId } },
      });
    }

    return order;
  });
}

// ==================== READ / UPDATE / REFUND ====================

export async function getAllOrdersService(filters: { customerId?: string }) {
  return prisma.order.findMany({
    where: filters.customerId ? { customerId: filters.customerId } : {},
    include: { orderItems: true, payment: true, customer: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOrderByIdService(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      orderItems: { include: { product: true, variant: true } },
      payment: true,
      customer: true,
      address: true,
      refunds: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  return order;
}

export async function updateOrderStatusService(id: string, status: string) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    throw new Error("Order not found");
  }

  return prisma.order.update({
    where: { id },
    data: { status: status as any },
  });
}

export async function refundOrderService(
  id: string,
  amount: number,
  reason: string,
  processedById: string,
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: { orderItems: true, payment: true },
    });

    if (!order) {
      throw new Error("Order not found");
    }
    if (order.status === "REFUNDED") {
      throw new Error("Order is already refunded");
    }

    await restoreStock(tx, order.orderItems);

    await tx.order.update({ where: { id }, data: { status: "REFUNDED" } });

    if (order.payment) {
      await tx.payment.update({
        where: { id: order.payment.id },
        data: { status: "REFUNDED" },
      });
    }

    return tx.refund.create({
      data: {
        orderId: id,
        amount,
        reason,
        status: "COMPLETED",
        processedById,
      },
    });
  });
}
