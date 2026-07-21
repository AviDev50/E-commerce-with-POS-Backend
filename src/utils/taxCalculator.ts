import { GstType } from "@prisma/client";

interface TaxBreakdown {
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
}

export function calculateTaxBreakdown(
  taxableAmount: number,
  taxRatePercent: number,
  gstType: GstType
): TaxBreakdown {
  const taxAmount = (taxableAmount * taxRatePercent) / 100;

  if (gstType === "INTRA_STATE") {
    const half = taxAmount / 2;
    return { taxAmount, cgstAmount: half, sgstAmount: half, igstAmount: 0 };
  }

  return { taxAmount, cgstAmount: 0, sgstAmount: 0, igstAmount: taxAmount };
}