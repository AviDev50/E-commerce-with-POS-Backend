import prisma from "../../config/db.js";
import { Prisma } from "@prisma/client";
import { fail } from "../../utils/fail.js";

async function getOrCreateWalletTx(tx: Prisma.TransactionClient, customerId: string) {
  let wallet = await tx.wallet.findUnique({ where: { customerId } });
  if (!wallet) {
    try {
      wallet = await tx.wallet.create({ data: { customerId } });
    } catch (e: any) {
      if (e.code !== "P2002") throw e; // race: dusre ne bana diya
      wallet = await tx.wallet.findUnique({ where: { customerId } });
    }
  }
  return wallet!;
}

export async function creditWalletTx(
  tx: Prisma.TransactionClient,
  p: { customerId: string; amount: number; reason: string; returnRequestId?: string; orderId?: string },
) {
  if (p.amount <= 0) return null;
  const wallet = await getOrCreateWalletTx(tx, p.customerId);

  const updated = await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: { increment: p.amount } },
  });

  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "CREDIT",
      amount: p.amount,
      balanceAfter: updated.balance,
      reason: p.reason,
      returnRequestId: p.returnRequestId,
      orderId: p.orderId,
    },
  });
  return updated;
}

// Atomic check-and-decrement: balance kam ho to count 0 aata hai, race safe
export async function debitWalletTx(
  tx: Prisma.TransactionClient,
  p: { customerId: string; amount: number; reason: string; orderId?: string },
) {
  if (p.amount <= 0) return null;

  const result = await tx.wallet.updateMany({
    where: { customerId: p.customerId, balance: { gte: p.amount } },
    data: { balance: { decrement: p.amount } },
  });
  if (result.count === 0) return fail("Insufficient wallet balance");

  const wallet = await tx.wallet.findUnique({ where: { customerId: p.customerId } });
  await tx.walletTransaction.create({
    data: {
      walletId: wallet!.id,
      type: "DEBIT",
      amount: p.amount,
      balanceAfter: wallet!.balance,
      reason: p.reason,
      orderId: p.orderId,
    },
  });
  return wallet;
}

export async function getMyWalletService(customerId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { customerId } });
  return { balance: Number(wallet?.balance ?? 0) };
}

export async function getMyWalletTransactionsService(customerId: string, page = 1, limit = 20) {
  const where = { wallet: { customerId } };
  const [items, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return {
    items: items.map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      balanceAfter: Number(t.balanceAfter),
      reason: t.reason,
      orderId: t.orderId,
      createdAt: t.createdAt,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}