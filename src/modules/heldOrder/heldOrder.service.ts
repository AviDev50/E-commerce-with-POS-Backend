import prisma from "../../config/db.js";
import { HeldOrderStatus } from "@prisma/client";

interface HeldItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

interface HoldOrderInput {
  cashierId: string;
  customerId?: string;
  items: HeldItemInput[];
  note?: string;
}

// ==================== HOLD (park current cart) ====================
export async function holdOrderService(data: HoldOrderInput) {
  if (!data.items || data.items.length === 0) {
    const err: any = new Error("Cannot hold an empty cart");
    err.statusCode = 400;
    throw err;
  }

  return prisma.heldOrder.create({
    data: {
      cashierId: data.cashierId,
      customerId: data.customerId,
      items: data.items as any, // JSON field — raw cart, resolve later at resume/checkout
      note: data.note,
      status: HeldOrderStatus.HELD,
    },
  });
}

// ==================== LIST (billing screen ka "held orders" panel) ====================
// Counter-shared rakha hai — koi bhi staff kisi bhi cashier ka held order resume kar sake,
// jaisa real dukaan mein hota hai (shift badle to bhi purane held orders serve ho sakein).
export async function listHeldOrdersService(filters: { cashierId?: string }) {
  return prisma.heldOrder.findMany({
    where: {
      status: HeldOrderStatus.HELD,
      cashierId: filters.cashierId,
    },
    include: {
      cashier: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ==================== GET SINGLE (resume se pehle detail dikhane ke liye) ====================
export async function getHeldOrderByIdService(id: string) {
  const held = await prisma.heldOrder.findUnique({
    where: { id },
    include: {
      cashier: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, phone: true } },
    },
  });

  if (!held) {
    const err: any = new Error("Held order not found");
    err.statusCode = 404;
    throw err;
  }

  return held;
}

// ==================== RESUME (frontend cart mein items wapas load karega) ====================
export async function resumeHeldOrderService(id: string) {
  const held = await prisma.heldOrder.findUnique({ where: { id } });

  if (!held) {
    const err: any = new Error("Held order not found");
    err.statusCode = 404;
    throw err;
  }

  if (held.status !== HeldOrderStatus.HELD) {
    const err: any = new Error(
      `Cannot resume — this order is already ${held.status}`,
    );
    err.statusCode = 400;
    throw err;
  }

  // Status RESUMED mark karo taaki list se hat jaye — actual order abhi POS /pos endpoint se banega
  const updated = await prisma.heldOrder.update({
    where: { id },
    data: { status: HeldOrderStatus.RESUMED, resumedAt: new Date() },
  });

  return updated; // frontend "items" field se cart prefill karega
}

// ==================== CANCEL (discard, soft-delete style) ====================
export async function cancelHeldOrderService(id: string) {
  const held = await prisma.heldOrder.findUnique({ where: { id } });

  if (!held) {
    const err: any = new Error("Held order not found");
    err.statusCode = 404;
    throw err;
  }

  if (held.status !== HeldOrderStatus.HELD) {
    const err: any = new Error(
      `Cannot cancel — this order is already ${held.status}`,
    );
    err.statusCode = 400;
    throw err;
  }

  return prisma.heldOrder.update({
    where: { id },
    data: { status: HeldOrderStatus.CANCELLED },
  });
}
