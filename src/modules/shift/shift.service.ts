import prisma from "../../config/db.js";
import { ShiftStatus} from "@prisma/client";

interface OpenShiftInput {
  cashierId: string;
  openingCash: number;
}

interface CloseShiftInput {
  shiftId: string;
  cashierId: string;
  closingCash: number;
}

// ==================== OPEN SHIFT ====================
export async function openShiftService(data: OpenShiftInput) {
  // Ek cashier ki ek time pe sirf ek OPEN shift ho sakti hai
  const existingOpen = await prisma.shift.findFirst({
    where: { cashierId: data.cashierId, status: ShiftStatus.OPEN },
  });

  if (existingOpen) {
    const err: any = new Error("You already have an open shift. Please close it first.");
    err.statusCode = 400;
    throw err;
  }

  return prisma.shift.create({
    data: {
      cashierId: data.cashierId,
      openingCash: data.openingCash,
      status: ShiftStatus.OPEN,
    },
  });
}

// ==================== GET ACTIVE SHIFT (for billing screen + order enforcement) ====================
export async function getActiveShiftService(cashierId: string) {
  return prisma.shift.findFirst({
    where: { cashierId, status: ShiftStatus.OPEN },
  });
}

// ==================== CLOSE SHIFT (reconciliation yahi hota hai) ====================
export async function closeShiftService(data: CloseShiftInput) {
  const shift = await prisma.shift.findUnique({ where: { id: data.shiftId } });

  if (!shift) {
    const err: any = new Error("Shift not found");
    err.statusCode = 404;
    throw err;
  }

  if (shift.cashierId !== data.cashierId) {
    const err: any = new Error("You can only close your own shift");
    err.statusCode = 403;
    throw err;
  }

  if (shift.status === ShiftStatus.CLOSED) {
    const err: any = new Error("Shift is already closed");
    err.statusCode = 400;
    throw err;
  }

  // Is shift ke dauraan hui saari CASH payments nikaalo (POS orders ke through)
  const cashPayments = await prisma.payment.findMany({
    where: {
      method: "CASH",
      order: { shiftId: data.shiftId },
    },
    select: { amount: true },
  });
  const totalCashSales = cashPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  // Is shift ke dauraan diye gaye refunds — sirf CASH-paid orders ke against
  // (agar CARD se pay kiya tha aur refund hua, wo drawer ka cash nahi hai)
 const cashRefunds = await prisma.refund.findMany({
  where: {
    OR: [
      { shiftId: data.shiftId, method: "CASH" },
      {
        shiftId: null,
        method: null,
        order: { shiftId: data.shiftId, payments: { some: { method: "CASH" } } },
      },
    ],
  },
  select: { amount: true },
});
const totalCashRefunds = cashRefunds.reduce((sum, r) => sum + Number(r.amount), 0);
  const expectedCash =
    Number(shift.openingCash) + totalCashSales - totalCashRefunds;
  const discrepancy = Number((data.closingCash - expectedCash).toFixed(2));

  return prisma.shift.update({
    where: { id: data.shiftId },
    data: {
      status: ShiftStatus.CLOSED,
      closingCash: data.closingCash,
      expectedCash,
      discrepancy,
      closedAt: new Date(),
    },
  });
}

// ==================== SHIFT HISTORY / LIST ====================
export async function listShiftsService(filters: { cashierId?: string; status?: ShiftStatus }) {
  return prisma.shift.findMany({
    where: {
      cashierId: filters.cashierId,
      status: filters.status,
    },
    include: {
      cashier: { select: { id: true, name: true } },
    },
    orderBy: { openedAt: "desc" },
  });
}