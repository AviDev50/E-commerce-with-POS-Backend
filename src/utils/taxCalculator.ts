import { Prisma } from "@prisma/client";

interface TaxBreakdownItem {
  name: string;
  rate: number;
  amount: number;
}

export async function resolveTaxBreakdown(
  tx: Prisma.TransactionClient,
  taxClassId: string | null,
  destCountry: string,
  destState: string,
  originCountry: string | null,
  originState: string | null,
  taxableAmount: number
): Promise<{ taxAmount: number; breakdown: TaxBreakdownItem[] }> {
  if (!taxClassId) {
    return { taxAmount: 0, breakdown: [] };
  }

  const rates = await tx.taxRate.findMany({
    where: {
      taxClassId,
      country: destCountry,
      OR: [{ state: destState }, { state: null }],
    },
    orderBy: { priority: "asc" },
  });

  const isOriginSameAsDest =
    !!originCountry && !!originState && originCountry === destCountry && originState === destState;

  let runningAmount = taxableAmount;
  let totalTax = 0;
  const breakdown: TaxBreakdownItem[] = [];

  for (const r of rates) {
    if (r.appliesWhen === "ORIGIN_MATCH" && !isOriginSameAsDest) continue;
    if (r.appliesWhen === "ORIGIN_MISMATCH" && isOriginSameAsDest) continue;

    const base = r.isCompound ? runningAmount : taxableAmount;
    const amount = (base * Number(r.rate)) / 100;

    breakdown.push({ name: r.name, rate: Number(r.rate), amount });
    totalTax += amount;

    if (r.isCompound) runningAmount += amount;
  }

  return { taxAmount: totalTax, breakdown };
}