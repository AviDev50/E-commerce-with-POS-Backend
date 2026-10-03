import prisma from "../../config/db.js";
import { Prisma, PaymentMethod, PaymentStatus } from "@prisma/client";
import { resolveTaxBreakdown } from "../../utils/taxCalculator.js";
import { generateOrderNumber } from "../../utils/orderNumberGenerator.js";
import { computeCouponDiscount } from "../../utils/couponValidator.js";
import { formatImageUrl } from "../../utils/formatImageUrl.js";
import { OrderStatus } from "@prisma/client";

interface OrderItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

// naya — ek single payment entry ka shape (split payment ke liye array mein use hoga)
interface PaymentInput {
  method: PaymentMethod;
  amount: number;
  transactionRef?: string; // optional — CARD/UPI ke liye reference number store karna ho to
}

interface CreatePosOrderInput {
  items: OrderItemInput[];
  customerId?: string;
  newCustomer?: { name: string; phone: string; email?: string };
  couponCode?: string;
  payments: PaymentInput[]; // paymentMethod (single) ki jagah ab ye array hai
  createdById: string;
}

interface CreateOnlineOrderInput {
  items: OrderItemInput[];
  addressId: string;
  couponCode?: string;
  customerId: string;
  cartItemIds?: string[];
  paymentMethod: PaymentMethod; // online abhi single-payment hi rahega bas cod
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

interface InstantExchangeInput {
  orderItemId: string; // original order ka item jo exchange ho raha hai
  quantity: number;
  newProductId: string;
  newVariantId?: string;
  payments?: PaymentInput[]; // agar naya item mehenga hai — customer se extra liya
  refundMethod?: PaymentMethod; // agar naya item sasta hai — customer ko wapas diya
  createdById: string;
}

// ==================== SHARED HELPERS ====================
async function resolvePosCustomer(
  tx: Prisma.TransactionClient,
  data: CreatePosOrderInput,
) {
  let customer;

  if (data.newCustomer) {
    const { name, phone, email } = data.newCustomer;
    try {
      customer = await tx.customer.upsert({
        where: { phone },
        update: {}, // existing ka data overwrite nahi
        create: { name, phone, email },
      });
    } catch (e: any) {
      // MySQL pe upsert atomic nahi hai → race mein P2002 aayega
      if (e.code !== "P2002") throw e;
      customer = await tx.customer.findUnique({ where: { phone } });
    }
  } else {
    customer = await tx.customer.findUnique({ where: { id: data.customerId } });
  }

  if (!customer || !customer.isActive) {
    const err: any = new Error("Customer not found or inactive");
    err.statusCode = 400;
    throw err;
  }
  return customer;
}

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
      // NAYA: agar variantId nahi diya, check karo ki is product ke variants exist toh nahi karte.
      // Agar karte hain, to base product select karna galat hai — cashier ko specific
      // variant (Size/Color) choose karna zaroori hai, warna galat price/stock use ho jayega.
      const variantCount = await tx.productVariant.count({
        where: { productId: item.productId },
      });
      if (variantCount > 0) {
        const err: any = new Error(
          `Please select a variant for: ${product.name}`,
        );
        err.statusCode = 400;
        throw err;
      }
      price = Number(product.price);
    }

    const taxClassId =
      product.taxClassId ?? product.category?.taxClassId ?? null;

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

// ==================== SHARED: Confirmed Order Creation (COD + Razorpay dono use karenge) ====================

interface ConfirmedOrderPaymentInput {
  method: PaymentMethod;
  status: PaymentStatus;
  transactionRef?: string;
}

interface CreateConfirmedOrderInput {
  customerId: string;
  addressId: string;
  couponCode?: string;
  items: OrderItemInput[];
  payment: ConfirmedOrderPaymentInput; // ONLINE channel mein hamesha single payment hota hai (split sirf POS mein hai)
  status: "PENDING"; // order lifecycle status — payment status se independent (fulfillment abhi baaki hai chahe paisa mil chuka ho)
  gatewayOrderId?: string; // Razorpay ke liye — idempotency ke liye
  cartItemIds?: string[];
}

export async function createConfirmedOrderService(input: CreateConfirmedOrderInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const address = await tx.address.findUnique({ where: { id: input.addressId } });
      if (!address || address.customerId !== input.customerId) {
        throw new Error("Address not found");
      }

      const storeSettings = await tx.storeSettings.findFirst();
      const storeCountry = storeSettings?.country ?? null;
      const storeState = storeSettings?.state ?? null;

      const resolvedItems = await resolveOrderItems(tx, input.items);
      await deductStock(tx, resolvedItems); // yahi step Razorpay mein PAYMENT SUCCESS ke baad hoga (COD mein order-create ke saath)

      const subtotal = resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

      let discount = 0;
      let couponId: string | undefined;
      if (input.couponCode) {
        const couponResult = await applyCoupon(tx, input.couponCode, subtotal);
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
      const total = subtotal - discount + totalTax; // yahi authoritative total hai — payment amount ISSE derive hoga, kisi bhi upstream estimate se nahi

      const orderNumber = await generateOrderNumber(tx);

      const order = await tx.order.create({
        data: {
          orderNumber,
          channel: "ONLINE",
          status: input.status,
          customerId: input.customerId,
          addressId: input.addressId,
          couponId,
          gatewayOrderId: input.gatewayOrderId,
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
              taxBreakdown: i.taxBreakdown as unknown as Prisma.InputJsonValue,
            })),
          },
          payments: {
            create: [
              {
                method: input.payment.method,
                status: input.payment.status,
                amount: total, // total hamesha yahin se compute hoga, caller se nahi liya — mismatch impossible
                transactionRef: input.payment.transactionRef,
              },
            ],
          },
        },
        include: { orderItems: true, payments: true },
      });

      if (input.cartItemIds && input.cartItemIds.length > 0) {
        await tx.cartItem.deleteMany({
          where: { id: { in: input.cartItemIds }, cart: { customerId: input.customerId } },
        });
      }

      return order;
    });
  } catch (err: any) {
    // Razorpay ka verify (frontend) aur webhook (server-to-server) dono almost saath call ho sakte hain —
    // agar dono transaction chala ke @@unique(gatewayOrderId) pe collide karein, jo pehle fail hua
    // usko yeh existing order return kar dega, dobara stock deduct nahi hoga (transaction rollback ho chuka hoga)
    if (input.gatewayOrderId && err.code === "P2002") {
      const existing = await prisma.order.findUnique({
        where: { gatewayOrderId: input.gatewayOrderId },
        include: { orderItems: true, payments: true },
      });
      if (existing) return existing;
    }
    throw err;
  }
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
     // NAYA: cashier ki active OPEN shift check karo — bina shift ke billing nahi hogi
    const activeShift = await tx.shift.findFirst({
      where: { cashierId: data.createdById, status: "OPEN" },
    });

    if (!activeShift) {
      const err: any = new Error("Please open a shift before billing");
      err.statusCode = 400;
      throw err;
    }

    const customer = await resolvePosCustomer(tx, data);

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

    // ---- NAYA: payments validation ----
    // Sabhi payment entries ka sum order ke total ke EXACTLY barabar hona chahiye.
    // Paise (2 decimal) tak precision ke liye *100 karke integer compare kiya —
    // floating point drift (0.1 + 0.2 !== 0.3 jaisi dikkat) se bachne ka standard tareeka.
    const paymentsTotal = data.payments.reduce((sum, p) => sum + p.amount, 0);

    if (Math.round(paymentsTotal * 100) !== Math.round(total * 100)) {
      const err: any = new Error(
        `Payment amount (${paymentsTotal}) does not match order total (${total})`,
      );
      err.statusCode = 400;
      throw err;
    }

    const orderNumber = await generateOrderNumber(tx);

    return tx.order.create({
      data: {
        orderNumber,
        channel: "POS",
        status: "COMPLETED",
        customerId:  customer.id,
        createdById: data.createdById,
            shiftId: activeShift.id, // NAYA: order ko shift se link kiya
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
            taxBreakdown: i.taxBreakdown as unknown as Prisma.InputJsonValue,
          })),
        },
        // NAYA: single "payment: { create: {...} }" ki jagah ab
        // "payments: { create: [...] }" — ek order ke multiple Payment records ban sakte hain.
        // Har entry PAID status ke saath directly create hoti hai (POS = turant settle hota hai).
        payments: {
          create: data.payments.map((p) => ({
            method: p.method,
            status: "PAID",
            amount: p.amount,
            transactionRef: p.transactionRef,
          })),
        },
      },
      // "payment: true" (singular) ki jagah "payments: true" (array) — Prisma relation change ki wajah se
      include: { orderItems: true, payments: true },
    });
  });
}

// ==================== ONLINE ORDER ====================
export async function createOnlineOrderService(data: CreateOnlineOrderInput) {
  if (data.paymentMethod !== "COD") {
    throw new Error("Only COD payment is supported at the moment");
  }

  return createConfirmedOrderService({
    customerId: data.customerId,
    addressId: data.addressId,
    couponCode: data.couponCode,
    items: data.items,
    payment: { method: "COD", status: "PENDING" },
    status: "PENDING",
    cartItemIds: data.cartItemIds,
  });
}

// ==================== PREVIEW (read-only) ====================

export async function previewOnlineOrderService(data: PreviewOrderInput) {
  const address = await prisma.address.findUnique({
    where: { id: data.addressId },
  });
  if (!address || address.customerId !== data.customerId) {
    throw new Error("Address not found");
  }

  const storeSettings = await prisma.storeSettings.findFirst();
  const storeCountry = storeSettings?.country ?? null;
  const storeState = storeSettings?.state ?? null;

  const resolvedItems = await resolveOrderItems(
    prisma as unknown as Prisma.TransactionClient,
    data.items,
  );

  const itemsWithDetails = await Promise.all(
    resolvedItems.map(async (item) => {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      let availableStock = product?.stock ?? 0;
      let image: string | null = null;

      if (product?.images) {
        const parsed = JSON.parse(product.images || "[]");
        image = parsed[0] ? formatImageUrl(parsed[0]) : null;
      }

      if (item.variantId) {
        const variant = await prisma.productVariant.findUnique({
          where: { id: item.variantId },
        });
        availableStock = variant?.stock ?? 0;
        if (variant?.images) {
          const parsedVariant = JSON.parse(variant.images || "[]");
          if (parsedVariant[0]) image = formatImageUrl(parsedVariant[0]);
        }
      }

      return {
        ...item,
        availableStock,
        inStock: availableStock >= item.quantity,
        image,
      };
    }),
  );

  const subtotal = resolvedItems.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0,
  );

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
    couponApplied:
      data.couponCode && !couponError ? data.couponCode.toUpperCase() : null,
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
      payments: true, // FIX: "payment" → "payments"
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
      payments: true, // FIX: "payment" → "payments"
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
    const error: any = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
    const error: any = new Error(`Invalid order status: ${status}`);
    error.statusCode = 400;
    throw error;
  }

  const data: any = { status: status as OrderStatus };

  if (status === OrderStatus.COMPLETED && !order.deliveredAt) {
    data.deliveredAt = new Date();
  }

  return prisma.order.update({
    where: { id },
    data,
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
      include: { orderItems: true, payments: true }, // FIX: "payment" → "payments"
    });

    if (!order) {
      throw new Error("Order not found");
    }
    if (order.status === "REFUNDED") {
      throw new Error("Order is already refunded");
    }

    await restoreStock(tx, order.orderItems);

    await tx.order.update({ where: { id }, data: { status: "REFUNDED" } });

    // FIX: pehle sirf ek "order.payment" tha, ab "order.payments" array hai
    // (split payment ki wajah se ek order ke multiple Payment records ho sakte hain) —
    // isliye updateMany se orderId ke sabhi payments ko ek saath REFUNDED mark kar rahe hain
    if (order.payments.length > 0) {
      await tx.payment.updateMany({
        where: { orderId: id },
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

export async function cancelOrderService(
  id: string,
  customerId: string,
  reason: string,
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: { orderItems: true, payments: true }, // FIX: "payment" → "payments"
    });

    if (!order || order.customerId !== customerId) {
      throw new Error("Order not found");
    }

    if (
      order.status === "CANCELLED" ||
      order.status === "COMPLETED" ||
      order.status === "REFUNDED"
    ) {
      throw new Error(
        `Order cannot be cancelled — current status is ${order.status}`,
      );
    }

    await restoreStock(tx, order.orderItems);

    await tx.order.update({ where: { id }, data: { status: "CANCELLED" } });

    // FIX: yahan bhi sabhi payments ko FAILED mark karo (split payment case)
    if (order.payments.length > 0) {
      await tx.payment.updateMany({
        where: { orderId: id },
        data: { status: "FAILED" },
      });
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

// ==================== RECEIPT (print-ready structured data) ====================
// Ye function koi PDF/thermal-format nahi banata — sirf clean JSON deta hai.
// Frontend (POS Panel) isko HTML template mein render karke window.print() karega,
// ya future mein PDF-generation library se convert kar sakta hai.

export async function getOrderReceiptService(id: string, requestingCustomerId?: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      orderItems: {
        include: {
          product: { select: { name: true, sku: true } },
          variant: { select: { name: true, sku: true } },
        },
      },
      payments: true,
      customer: { select: { name: true, phone: true } },
      createdBy: { select: { name: true } },
    },
  });

  if (!order) {
    const err: any = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  // customer khud call kar raha hai to check karo ye uska hi order hai
  if (requestingCustomerId !== undefined && order.customerId !== requestingCustomerId) {
    const err: any = new Error("You do not have access to this order");
    err.statusCode = 403;
    throw err;
  }

  const storeSettings = await prisma.storeSettings.findFirst();

  return {
    store: {
      businessName: storeSettings?.businessName ?? "",
      address: storeSettings?.address ?? "",
      phone: storeSettings?.phone ?? "",
      email: storeSettings?.email ?? "",
    },
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      channel: order.channel,
      createdAt: order.createdAt,
      cashierName: order.createdBy?.name ?? null,
    },
    customer: order.customer
      ? { name: order.customer.name, phone: order.customer.phone }
      : null,
    items: order.orderItems.map((item) => ({
      productName: item.variant?.name
        ? `${item.product.name} - ${item.variant.name}`
        : item.product.name,
      sku: item.variant?.sku ?? item.product.sku,
      quantity: item.quantity,
      price: Number(item.price),
      taxAmount: Number(item.taxAmount),
      subtotal: Number(item.subtotal),
      lineTotal: Number(item.subtotal) + Number(item.taxAmount),
    })),
    payments: order.payments.map((p) => ({
      method: p.method,
      amount: Number(p.amount),
    })),
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    tax: Number(order.tax),
    total: Number(order.total),
  };
}

interface PosOrderHistoryFilters {
  from?: string;
  to?: string;
  cashierId?: string;
  requestingUserId: string;
  requestingUserRole: string;
  page?: number;
  limit?: number;
}

export async function getPosOrderHistoryService(filters: PosOrderHistoryFilters) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const limit = filters.limit && filters.limit > 0 ? filters.limit : 20;

  // Cashier-scoping: CASHIER role apne aap sirf apna data dekhega, override nahi ho sakta
  let effectiveCashierId: string | undefined;
  if (filters.requestingUserRole === "CASHIER") {
    effectiveCashierId = filters.requestingUserId;
  } else if (filters.cashierId) {
    effectiveCashierId = filters.cashierId;
  }

  const where: any = { channel: "POS" };
  if (effectiveCashierId) {
    where.createdById = effectiveCashierId;
  }
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = new Date(filters.from);
    if (filters.to) where.createdAt.lte = new Date(filters.to);
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        orderItems: {
          select: {
            id: true,
            quantity: true,
            returnedQty: true,
            product: { select: { name: true } },
            variant: { select: { name: true } },
          },
        },
        payments: { select: { method: true, amount: true } },
        customer: { select: { name: true, phone: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      customerName: o.customer?.name ?? "Walk-in",
      cashierName: o.createdBy?.name ?? null,
      itemCount: o.orderItems.length,
      items: o.orderItems.map((i) => ({
        id: i.id, // OrderItem.id, exchange API ke orderItemId ke liye
        productName: i.variant?.name
          ? `${i.product.name} - ${i.variant.name}`
          : i.product.name,
        quantity: i.quantity,
        returnedQty: i.returnedQty,
      })),
      payments: o.payments.map((p) => ({ method: p.method, amount: Number(p.amount) })),
      total: Number(o.total),
      createdAt: o.createdAt,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function instantPosExchangeService(data: InstantExchangeInput) {
  return prisma.$transaction(async (tx) => {
    const originalItem = await tx.orderItem.findUnique({
      where: { id: data.orderItemId },
      include: { order: true, product: true, variant: true },
    });

    if (!originalItem) {
      const err: any = new Error("Original order item not found");
      err.statusCode = 404;
      throw err;
    }

    const alreadyReturned = originalItem.returnedQty;
    const availableToExchange = originalItem.quantity - alreadyReturned;
    if (data.quantity <= 0 || data.quantity > availableToExchange) {
      const err: any = new Error(
        `Invalid quantity — only ${availableToExchange} unit(s) available to exchange`,
      );
      err.statusCode = 400;
      throw err;
    }

    // ---- Step 1: purane item ka stock restore karo ----
    if (originalItem.variantId) {
      await tx.productVariant.update({
        where: { id: originalItem.variantId },
        data: { stock: { increment: data.quantity } },
      });
    } else {
      await tx.product.update({
        where: { id: originalItem.productId },
        data: { stock: { increment: data.quantity } },
      });
    }

    // returnedQty mark karo taaki dobara same quantity exchange na ho sake
    await tx.orderItem.update({
      where: { id: data.orderItemId },
      data: { returnedQty: { increment: data.quantity } },
    });

    // ---- Step 2: naye item ka price/tax resolve + stock deduct karo ----
    const resolvedNewItems = await resolveOrderItems(tx, [
      { productId: data.newProductId, variantId: data.newVariantId, quantity: data.quantity },
    ]);
    await deductStock(tx, resolvedNewItems);

    const storeSettings = await tx.storeSettings.findFirst();
    const storeCountry = storeSettings?.country ?? "India";
    const storeState = storeSettings?.state ?? "";

    const itemsWithTax = await buildItemsWithTax(
      tx,
      resolvedNewItems,
      storeCountry,
      storeState,
      storeCountry,
      storeState,
    );

    const newItemTotal = itemsWithTax.reduce(
      (sum, i) => sum + i.subtotal + i.taxAmount,
      0,
    );

    // ---- Step 3: original item ka refund-equivalent value nikaalo ----
    const perUnitOriginalTotal =
      (Number(originalItem.subtotal) + Number(originalItem.taxAmount)) / originalItem.quantity;
    const originalItemTotal = Number((perUnitOriginalTotal * data.quantity).toFixed(2));

    const priceDiff = Number((newItemTotal - originalItemTotal).toFixed(2));

    // ---- Step 4: price-diff validate karo ----
    if (priceDiff > 0) {
      // Naya item mehenga — customer se extra payment lena hai
      if (!data.payments || data.payments.length === 0) {
        const err: any = new Error(
          `New item is costlier by ₹${priceDiff}. Payment is required.`,
        );
        err.statusCode = 400;
        throw err;
      }
      const paymentsTotal = data.payments.reduce((sum, p) => sum + p.amount, 0);
      if (Math.round(paymentsTotal * 100) !== Math.round(priceDiff * 100)) {
        const err: any = new Error(
          `Payment amount (${paymentsTotal}) does not match price difference (${priceDiff})`,
        );
        err.statusCode = 400;
        throw err;
      }
    } else if (priceDiff < 0) {
      // Naya item sasta — customer ko wapas dena hai
      if (!data.refundMethod) {
        const err: any = new Error(
          `New item is cheaper by ₹${Math.abs(priceDiff)}. refundMethod is required.`,
        );
        err.statusCode = 400;
        throw err;
      }
    }

    // ---- Step 5: naya POS exchange-order create karo (turant COMPLETED) ----
    const orderNumber = await generateOrderNumber(tx);

    const exchangeOrder = await tx.order.create({
      data: {
        orderNumber,
        channel: "POS",
        status: "COMPLETED",
        customerId: originalItem.order.customerId, // walk-in ho to null hi carry-forward hoga
        createdById: data.createdById,
        subtotal: itemsWithTax.reduce((sum, i) => sum + i.subtotal, 0),
        tax: itemsWithTax.reduce((sum, i) => sum + i.taxAmount, 0),
        discount: 0,
        total: newItemTotal,
        orderItems: {
          create: itemsWithTax.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
            price: i.price,
            subtotal: i.subtotal,
            taxAmount: i.taxAmount,
            taxBreakdown: i.taxBreakdown as unknown as Prisma.InputJsonValue,
          })),
        },
        payments: priceDiff > 0 && data.payments
          ? {
              create: data.payments.map((p) => ({
                method: p.method,
                status: "PAID",
                amount: p.amount,
              })),
            }
          : undefined,
      },
      include: { orderItems: true, payments: true },
    });

    // ---- Step 6: agar refund dena tha, Refund record banao ----
    let refund = null;
    if (priceDiff < 0) {
      refund = await tx.refund.create({
        data: {
          orderId: originalItem.orderId, // original order ke against refund
          amount: Math.abs(priceDiff),
          method: data.refundMethod,
          reason: "Instant POS exchange — price difference refund",
          status: "COMPLETED",
          processedById: data.createdById,
        },
      });
    }

    return { exchangeOrder, refund, priceDiff };
  });
}