import prisma from "../../config/db.js";
import { OrderStatus, OrderChannel } from "@prisma/client";

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

  const orderWhere: any = {
    createdAt: { gte: start, lte: end },
    status: { not: OrderStatus.CANCELLED }, // cancelled orders sale mein count nahi hote
  };
  if (effectiveCashierId) {
    orderWhere.createdById = effectiveCashierId;
  }

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
      order: effectiveCashierId ? { createdById: effectiveCashierId } : undefined,
    },
    select: { amount: true },
  });
  const totalRefunds = refunds.reduce((sum, r) => sum + Number(r.amount), 0);
  const netSales = grossSales - totalRefunds;

  // ---- 3. Payment method-wise breakdown ----
  // Payment table ko Order ke through filter kiya — split payment ki wajah se
  // ek order ke multiple Payment records ho sakte hain, isliye Order-level total se nahi,
  // Payment-level se hi accurate cash/card/upi split milega.
  const payments = await prisma.payment.findMany({
    where: { order: orderWhere },
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
    netSales,
    paymentBreakdown,
    channelBreakdown,
    cashierBreakdown,
  };
}