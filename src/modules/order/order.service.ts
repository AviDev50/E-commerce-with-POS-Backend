import prisma from "../../config/db.js";
import { Prisma, PaymentMethod } from "@prisma/client";
import { resolveTaxBreakdown } from "../../utils/taxCalculator.js";
import { generateOrderNumber } from "../../utils/orderNumberGenerator.js";
import { computeCouponDiscount } from "../../utils/couponValidator.js";
import { formatImageUrl } from "../../utils/formatImageUrl.js";

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

interface PreviewOrderInput {
  items: OrderItemInput[];
  addressId: string;
  couponCode?: string;
  customerId: string;
}

interface ResolvedItem {
  productId: string;
  productName: string;
  variantId?: string;
  quantity: number;
  price: number;
  taxClassId: string | null;
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

    const taxClassId = product.taxClassId ?? product.category?.taxClassId ?? null;

    resolved.push({
      productId: item.productId,
      productName: product.name,
      variantId: item.variantId,
      quantity: item.quantity,
      price,
      taxClassId,
    });
  }

  return resolved;
}

// Atomic check-and-decrement — race condition safe (row-lock via conditional UPDATE)
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

async function buildItemsWithTax(
  tx: Prisma.TransactionClient,
  items: ResolvedItem[],
  destCountry: string,
  destState: string,
  originCountry: string | null,
  originState: string | null,
) {
  const result = [];

  for (const item of items) {
    const itemSubtotal = item.price * item.quantity;
    const { taxAmount, breakdown } = await resolveTaxBreakdown(
      tx,
      item.taxClassId,
      destCountry,
      destState,
      originCountry,
      originState,
      itemSubtotal,
    );

    result.push({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      price: item.price,
      subtotal: itemSubtotal,
      taxAmount,
      taxBreakdown: breakdown,
    });
  }

  return result;
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

    const storeSettings = await tx.storeSettings.findFirst();
    const storeCountry = storeSettings?.country ?? "India";
    const storeState = storeSettings?.state ?? "";

    // POS = walk-in, destination == store itself → origin-match rules (CGST+SGST) apply
    const itemsWithTax = await buildItemsWithTax(
      tx,
      resolvedItems,
      storeCountry,
      storeState,
      storeCountry,
      storeState,
    );

    const totalTax = itemsWithTax.reduce((sum, i) => sum + i.taxAmount, 0);
    const total = subtotal - discount + totalTax;

    const orderNumber = await generateOrderNumber(tx);

    return tx.order.create({
      data: {
        orderNumber,
        channel: "POS",
        status: "COMPLETED",
        customerId: data.customerId,
        createdById: data.createdById,
        couponId,
        subtotal,
        tax: totalTax,
        discount,
        total,
        orderItems: {
          create: itemsWithTax.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
            price: i.price,
            subtotal: i.subtotal,
            taxAmount: i.taxAmount,
            taxBreakdown: i.taxBreakdown,
          })),
        },
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
    const storeCountry = storeSettings?.country ?? null;
    const storeState = storeSettings?.state ?? null;

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

    const itemsWithTax = await buildItemsWithTax(
      tx,
      resolvedItems,
      address.country,
      address.state,
      storeCountry,
      storeState,
    );

    const totalTax = itemsWithTax.reduce((sum, i) => sum + i.taxAmount, 0);
    const total = subtotal - discount + totalTax;

    const orderNumber = await generateOrderNumber(tx);

    const order = await tx.order.create({
      data: {
        orderNumber,
        channel: "ONLINE",
        status: "PENDING",
        customerId: data.customerId,
        addressId: data.addressId,
        couponId,
        subtotal,
        tax: totalTax,
        discount,
        total,
        orderItems: {
          create: itemsWithTax.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
            price: i.price,
            subtotal: i.subtotal,
            taxAmount: i.taxAmount,
            taxBreakdown: i.taxBreakdown,
          })),
        },
        payment: { create: { method: "COD", status: "PENDING", amount: total } },
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

// ==================== PREVIEW (read-only) ====================

export async function previewOnlineOrderService(data: PreviewOrderInput) {
  const address = await prisma.address.findUnique({ where: { id: data.addressId } });
  if (!address || address.customerId !== data.customerId) {
    throw new Error("Address not found");
  }

  const storeSettings = await prisma.storeSettings.findFirst();
  const storeCountry = storeSettings?.country ?? null;
  const storeState = storeSettings?.state ?? null;

  const resolvedItems = await resolveOrderItems(prisma as unknown as Prisma.TransactionClient, data.items);

  const itemsWithDetails = await Promise.all(
    resolvedItems.map(async (item) => {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });

      let availableStock = product?.stock ?? 0;
      let image: string | null = null;

      if (product?.images) {
        const parsed = JSON.parse(product.images || "[]");
        image = parsed[0] ? formatImageUrl(parsed[0]) : null;
      }

      if (item.variantId) {
        const variant = await prisma.productVariant.findUnique({ where: { id: item.variantId } });
        availableStock = variant?.stock ?? 0;
        if (variant?.images) {
          const parsedVariant = JSON.parse(variant.images || "[]");
          if (parsedVariant[0]) image = formatImageUrl(parsedVariant[0]);
        }
      }

      return { ...item, availableStock, inStock: availableStock >= item.quantity, image };
    }),
  );

  const subtotal = resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  let discount = 0;
  let couponError: string | undefined;

  if (data.couponCode) {
    try {
      const coupon = await prisma.coupon.findUnique({
        where: { code: data.couponCode.toUpperCase().trim() },
      });
      if (!coupon) throw new Error("Invalid coupon code");
      discount = computeCouponDiscount(coupon, subtotal);
    } catch (err: any) {
      couponError = err.message;
    }
  }

  const itemsWithTax = await buildItemsWithTax(
    prisma as unknown as Prisma.TransactionClient,
    resolvedItems,
    address.country,
    address.state,
    storeCountry,
    storeState,
  );

  const totalTax = itemsWithTax.reduce((sum, i) => sum + i.taxAmount, 0);
  const total = subtotal - discount + totalTax;

  const summaryItems = itemsWithTax.map((item, idx) => ({
    ...item,
    productName: resolvedItems[idx].productName,
    image: itemsWithDetails[idx].image,
    availableStock: itemsWithDetails[idx].availableStock,
    inStock: itemsWithDetails[idx].inStock,
  }));

  return {
    items: summaryItems,
    subtotal,
    discount,
    tax: totalTax,
    total,
    couponApplied: data.couponCode && !couponError ? data.couponCode.toUpperCase() : null,
    couponError: couponError ?? null,
  };
}

// ==================== READ / UPDATE / REFUND / CANCEL ====================

export async function getAllOrdersService(filters: { customerId?: string }) {
  const orders = await prisma.order.findMany({
    where: filters.customerId ? { customerId: filters.customerId } : {},
    include: {
      orderItems: {
        include: {
          product: { select: { id: true, name: true, images: true } },
          variant: { select: { id: true, name: true, images: true } },
        },
      },
      payment: true,
      customer: { select: { id: true, name: true, phone: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((order) => ({
    ...order,
    orderItems: order.orderItems.map((item) => {
      const rawImages = item.variant?.images || item.product.images;
      const parsed = JSON.parse(rawImages || "[]");
      const { product, variant, ...cleanItem } = item;

      return {
        ...cleanItem,
        productName: product.name,
        variantName: variant?.name || null,
        image: parsed[0] ? formatImageUrl(parsed[0]) : null,
      };
    }),
  }));
}

export async function getOrderByIdService(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      orderItems: {
        include: {
          product: { select: { id: true, name: true, images: true } },
          variant: { select: { id: true, name: true, images: true } },
        },
      },
      payment: true,
      customer: { select: { id: true, name: true, phone: true, email: true } },
      address: true,
      refunds: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  return {
    ...order,
    orderItems: order.orderItems.map((item) => {
      const rawImages = item.variant?.images || item.product.images;
      const parsed = JSON.parse(rawImages || "[]");
      const { product, variant, ...cleanItem } = item;

      return {
        ...cleanItem,
        productName: product.name,
        variantName: variant?.name || null,
        image: parsed[0] ? formatImageUrl(parsed[0]) : null,
      };
    }),
  };
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

export async function cancelOrderService(id: string, customerId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: { orderItems: true, payment: true },
    });

    if (!order || order.customerId !== customerId) {
      throw new Error("Order not found");
    }

    if (order.status === "CANCELLED" || order.status === "COMPLETED" || order.status === "REFUNDED") {
      throw new Error(`Order cannot be cancelled — current status is ${order.status}`);
    }

    await restoreStock(tx, order.orderItems);

    await tx.order.update({ where: { id }, data: { status: "CANCELLED" } });

    if (order.payment) {
      await tx.payment.update({ where: { id: order.payment.id }, data: { status: "FAILED" } });
    }

    return tx.refund.create({
      data: {
        orderId: id,
        amount: 0,
        reason,
        status: "COMPLETED",
      },
    });
  });
}