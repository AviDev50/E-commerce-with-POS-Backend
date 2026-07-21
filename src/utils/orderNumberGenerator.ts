import { Prisma } from "@prisma/client";

export async function generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);

  const count = await tx.order.count({
    where: { createdAt: { gte: startOfYear } },
  });

  const padded = String(count + 1).padStart(5, "0");
  return `ORD-${year}-${padded}`;
}