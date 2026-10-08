import prisma from "../../config/db.js";
import { OrderStatus, OrderChannel, ReturnType, ReturnStatus, Prisma } from "@prisma/client";

interface DailySalesFilters {
  from?: string;
  to?: string;
  cashierId?: string;
  requestingUserId: string;
  requestingUserRole: string;
}

// Date range resolve karo — agar from/to nahi diye, default "aaj" (00:00:00 se ab tak)
function resolveDateRange(from?: string, to?: string) {
  if (from && to) {
    return { start: new Date(from), end: new Date(to) };
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function getDailySalesReportService(filters: DailySalesFilters) {
  const { start, end } = resolveDateRange(filters.from, filters.to);

  // ---- Cashier-scoping: CASHIER role apne aap sirf apna data dekhega ----
  // Query param se override nahi ho sakta — security ke liye backend force karta hai.
  let effectiveCashierId: string | undefined;
  if (filters.requestingUserRole === "CASHIER") {
    effectiveCashierId = filters.requestingUserId;
  } else if (filters.cashierId) {
    // Manager/Admin optionally kisi specific cashier ka filter maang sakte hain
    effectiveCashierId = filters.cashierId;
  }

const baseOrderWhere: any = {
  createdAt: { gte: start, lte: end },
  status: { not: OrderStatus.CANCELLED },
};
if (effectiveCashierId) {
  baseOrderWhere.createdById = effectiveCashierId;
}

// exchange orders ka poora total sales mein nahi gina jaata, sirf priceDiff (neeche exchangeAdjustment)
const orderWhere = { ...baseOrderWhere, isExchange: false };

  // ---- 1. Overall totals ----
  const orders = await prisma.order.findMany({
    where: orderWhere,
    select: { id: true, total: true, channel: true, status: true },
  });

  const totalOrders = orders.length;
  const grossSales = orders.reduce((sum, o) => sum + Number(o.total), 0);

  // ---- 2. Refunds in this range (net sales ke liye) ----
const refunds = await prisma.refund.findMany({
  where: {
    createdAt: { gte: start, lte: end },
    OR: [{ returnRequestId: null }, { returnRequest: { type: ReturnType.RETURN } }],
    // cancelled order sales mein hai hi nahi, uska refund dobara minus nahi hona chahiye
    order: {
      status: { not: OrderStatus.CANCELLED },
      ...(effectiveCashierId ? { createdById: effectiveCashierId } : {}),
    },
  },
  select: { amount: true },
});
const totalRefunds = refunds.reduce((sum, r) => sum + Number(r.amount), 0);

// exchange = purane item ki return + naya sale, net asar sirf priceDiff
const exchanges = await prisma.returnRequest.findMany({
  where: {
    type: ReturnType.EXCHANGE,
    status: ReturnStatus.EXCHANGED,
    exchangeOrder: {
      createdAt: { gte: start, lte: end },
      ...(effectiveCashierId ? { createdById: effectiveCashierId } : {}),
    },
  },
  select: { priceDiff: true },
});
const exchangeAdjustment = Number(
  exchanges.reduce((sum, e) => sum + Number(e.priceDiff ?? 0), 0).toFixed(2),
);

const netSales = grossSales - totalRefunds + exchangeAdjustment;
  // ---- 3. Payment method-wise breakdown ----
  // Payment table ko Order ke through filter kiya — split payment ki wajah se
  // ek order ke multiple Payment records ho sakte hain, isliye Order-level total se nahi,
  // Payment-level se hi accurate cash/card/upi split milega.
 const payments = await prisma.payment.findMany({
  where: { order: baseOrderWhere },
  select: { method: true, amount: true },
});
  const paymentBreakdown: Record<string, number> = {};
  for (const p of payments) {
    paymentBreakdown[p.method] = (paymentBreakdown[p.method] ?? 0) + Number(p.amount);
  }

  // ---- 4. Channel-wise (POS vs Online) ----
  const channelBreakdown: Record<string, { count: number; total: number }> = {
    [OrderChannel.POS]: { count: 0, total: 0 },
    [OrderChannel.ONLINE]: { count: 0, total: 0 },
  };
  for (const o of orders) {
    channelBreakdown[o.channel].count += 1;
    channelBreakdown[o.channel].total += Number(o.total);
  }

  // ---- 5. Cashier-wise breakdown ----
  // Sirf tab compute karo jab Manager/Admin dekh raha ho aur specific cashier filter nahi diya —
  // taaki poori team ka comparison mile. Cashier khud apna dekh raha ho to ye section skip.
  let cashierBreakdown: { cashierId: string; cashierName: string; totalSales: number; orderCount: number }[] = [];

  if (filters.requestingUserRole !== "CASHIER" && !filters.cashierId) {
    const grouped = await prisma.order.groupBy({
      by: ["createdById"],
      where: { ...orderWhere, channel: OrderChannel.POS },
      _sum: { total: true },
      _count: { id: true },
    });

    const cashierIds = grouped.map((g) => g.createdById).filter((id): id is string => !!id);
    const cashiers = await prisma.user.findMany({
      where: { id: { in: cashierIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(cashiers.map((c) => [c.id, c.name]));

    cashierBreakdown = grouped
      .filter((g) => g.createdById)
      .map((g) => ({
        cashierId: g.createdById as string,
        cashierName: nameMap.get(g.createdById as string) ?? "Unknown",
        totalSales: Number(g._sum.total ?? 0),
        orderCount: g._count.id,
      }));
  }

return {
  dateRange: { from: start, to: end },
  totalOrders,
  grossSales,
  totalRefunds,
  exchangeAdjustment,
  netSales,
  paymentBreakdown,
  channelBreakdown,
  cashierBreakdown,
};
}

interface ReturnsReportFilters {
  from?: string;
  to?: string;
  type?: ReturnType;
  channel?: OrderChannel;
  page?: number;
  limit?: number;
  requestingUserId: string;
  requestingUserRole: string;
}

export async function getReturnsExchangeReportService(f: ReturnsReportFilters) {
  const { start, end } = resolveDateRange(f.from, f.to);
  const isCashier = f.requestingUserRole === "CASHIER";
  const page = f.page && f.page > 0 ? f.page : 1;
  const limit = f.limit && f.limit > 0 ? f.limit : 20;

  // sirf completed requests, completion time = updatedAt (final status ke baad request update nahi hoti)
  const where: Prisma.ReturnRequestWhereInput = {
    status: { in: [ReturnStatus.REFUNDED, ReturnStatus.EXCHANGED] },
    updatedAt: { gte: start, lte: end },
  };
  if (f.type) where.type = f.type;
  if (f.channel) where.orderItem = { order: { channel: f.channel } };
  if (isCashier) {
    // cashier sirf apne POS exchanges dekhega
    where.type = ReturnType.EXCHANGE;
    where.exchangeOrder = { createdById: f.requestingUserId };
  }

  const rows = await prisma.returnRequest.findMany({
    where,
    select: {
      id: true,
      type: true,
      status: true,
      reason: true,
      quantity: true,
      settlement: true,
      originalValue: true,
      newValue: true,
      priceDiff: true,
      updatedAt: true,
      customer: { select: { name: true, phone: true } },
      orderItem: {
        select: {
          product: { select: { id: true, name: true } },
          order: { select: { orderNumber: true, channel: true } },
        },
      },
      exchangeOrder: { select: { orderNumber: true } },
      refund: { select: { amount: true, method: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const summary = {
    returns: { count: 0, units: 0, refunded: 0 },
    exchanges: { count: 0, units: 0, collected: 0, returnedToCustomer: 0, netDiff: 0 },
  };
  const bySettlement: Record<string, { count: number; amount: number }> = {};
  const byChannel: Record<string, number> = {};
  const byReason: Record<string, number> = {};
  const products = new Map<string, { productId: string; name: string; units: number; count: number }>();

  for (const r of rows) {
    const channel = r.orderItem.order.channel;
    byChannel[channel] = (byChannel[channel] ?? 0) + 1;
    byReason[r.reason] = (byReason[r.reason] ?? 0) + 1;

    const prod = products.get(r.orderItem.product.id) ?? {
      productId: r.orderItem.product.id,
      name: r.orderItem.product.name,
      units: 0,
      count: 0,
    };
    prod.units += r.quantity;
    prod.count += 1;
    products.set(prod.productId, prod);

    let amount = 0;
    if (r.type === ReturnType.RETURN) {
      amount = Number(r.refund?.amount ?? 0);
      summary.returns.count += 1;
      summary.returns.units += r.quantity;
      summary.returns.refunded += amount;
    } else {
      const diff = Number(r.priceDiff ?? 0);
      amount = Math.abs(diff);
      summary.exchanges.count += 1;
      summary.exchanges.units += r.quantity;
      if (diff > 0) summary.exchanges.collected += diff;
      if (diff < 0) summary.exchanges.returnedToCustomer += -diff;
      summary.exchanges.netDiff += diff;
    }

    const key = r.settlement ?? "NONE";
    const s = bySettlement[key] ?? { count: 0, amount: 0 };
    s.count += 1;
    s.amount += amount;
    bySettlement[key] = s;
  }

  // Full-order refunds (refundOrder) ReturnRequest nahi hote, wo alag se
  let orderRefunds = { count: 0, total: 0, byMethod: {} as Record<string, number> };
  if (!f.type) {
  const refunds = await prisma.refund.findMany({
  where: {
    returnRequestId: null,
    amount: { gt: 0 },
    createdAt: { gte: start, lte: end },
    ...(isCashier ? { processedById: f.requestingUserId } : {}),
    order: {
      status: { not: OrderStatus.CANCELLED },
      ...(f.channel ? { channel: f.channel } : {}),
    },
  },
  select: { amount: true, method: true },
});
    for (const r of refunds) {
      orderRefunds.count += 1;
      orderRefunds.total += Number(r.amount);
      const m = r.method ?? "UNSPECIFIED";
      orderRefunds.byMethod[m] = (orderRefunds.byMethod[m] ?? 0) + Number(r.amount);
    }
  }

  const round = (n: number) => Number(n.toFixed(2));
  const netImpactOnSales = round(
    -summary.returns.refunded + summary.exchanges.netDiff - orderRefunds.total,
  );

  return {
    dateRange: { from: start, to: end },
    summary: {
      returns: { ...summary.returns, refunded: round(summary.returns.refunded) },
      exchanges: {
        ...summary.exchanges,
        collected: round(summary.exchanges.collected),
        returnedToCustomer: round(summary.exchanges.returnedToCustomer),
        netDiff: round(summary.exchanges.netDiff),
      },
      orderRefunds: { ...orderRefunds, total: round(orderRefunds.total) },
      netImpactOnSales,
    },
    bySettlement,
    byChannel,
    byReason,
    topProducts: [...products.values()].sort((a, b) => b.units - a.units).slice(0, 10),
    items: rows.slice((page - 1) * limit, page * limit).map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      completedAt: r.updatedAt,
      channel: r.orderItem.order.channel,
      orderNumber: r.orderItem.order.orderNumber,
      exchangeOrderNumber: r.exchangeOrder?.orderNumber ?? null,
      customerName: r.customer.name,
      productName: r.orderItem.product.name,
      quantity: r.quantity,
      reason: r.reason,
      originalValue: r.originalValue !== null ? Number(r.originalValue) : null,
      newValue: r.newValue !== null ? Number(r.newValue) : null,
      priceDiff: r.priceDiff !== null ? Number(r.priceDiff) : null,
      settlement: r.settlement,
      refundAmount: r.refund ? Number(r.refund.amount) : null,
      refundMethod: r.refund?.method ?? null,
    })),
    pagination: { page, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit) },
  };
}


