import prisma from "../../config/db.js";
import { ReturnStatus, RefundStatus } from "@prisma/client";
import { fail } from "../../utils/fail.js";
import { maskUpi } from "../../utils/maskUpi.js";

const UPI_REGEX = /^[a-z0-9][a-z0-9._-]{1,255}@[a-z][a-z0-9]{1,63}$/;
const MAX_PAYOUT_METHODS = 5;

const LOCKING_RETURN_STATUSES: ReturnStatus[] = [
  ReturnStatus.REQUESTED,
  ReturnStatus.APPROVED,
  ReturnStatus.PICKUP_SCHEDULED,
  ReturnStatus.RECEIVED,
];

const toView = (m: {
  id: string;
  type: string;
  label: string | null;
  upiId: string;
}) => ({
  id: m.id,
  type: m.type,
  label: m.label,
  upiMasked: maskUpi(m.upiId), // poori UPI ID customer ko wapas nahi dikhti
});

// active request = request abhi chal rahi hai, ya uska UPI refund PENDING/FAILED hai
async function isLocked(methodId: string) {
  const count = await prisma.returnRequest.count({
    where: {
      payoutMethodId: methodId,
      OR: [
        { status: { in: LOCKING_RETURN_STATUSES } },
        {
          refund: {
            is: { status: { in: [RefundStatus.PENDING, RefundStatus.FAILED] } },
          },
        },
      ],
    },
  });
  return count > 0;
}

export async function addPayoutMethodService(
  customerId: string,
  input: { upiId?: string; label?: string },
) {
  const upiId = String(input.upiId ?? "")
    .trim()
    .toLowerCase();
  if (!UPI_REGEX.test(upiId))
    return fail("Invalid UPI ID (example: name@bank)");
  const label = input.label?.trim() || null;

  const existing = await prisma.payoutMethod.findUnique({
    where: { customerId_upiId: { customerId, upiId } },
  });
  if (existing?.isActive) return fail("This UPI ID is already saved", 409);

  const activeCount = await prisma.payoutMethod.count({
    where: { customerId, isActive: true },
  });
  if (activeCount >= MAX_PAYOUT_METHODS) {
    return fail(`You can save up to ${MAX_PAYOUT_METHODS} UPI IDs`);
  }

  const saved = existing
    ? await prisma.payoutMethod.update({
        where: { id: existing.id },
        data: { isActive: true, label },
      })
    : await prisma.payoutMethod.create({ data: { customerId, upiId, label } });

  return toView(saved);
}

export async function listPayoutMethodsService(customerId: string) {
  const methods = await prisma.payoutMethod.findMany({
    where: { customerId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  return methods.map(toView);
}

export async function deletePayoutMethodService(
  customerId: string,
  id: string,
) {
  const method = await prisma.payoutMethod.findUnique({ where: { id } });
  if (!method || method.customerId !== customerId || !method.isActive) {
    return fail("Payout method not found", 404);
  }
  if (await isLocked(id)) {
    return fail(
      "This UPI ID is used in an active return/exchange request and cannot be deleted",
    );
  }

  // kabhi kisi request/refund mein use nahi hua to asli delete, warna soft delete (audit)
  const [requests, refunds] = await Promise.all([
    prisma.returnRequest.count({ where: { payoutMethodId: id } }),
    prisma.refund.count({ where: { payoutMethodId: id } }),
  ]);
  if (requests + refunds === 0) {
    await prisma.payoutMethod.delete({ where: { id } });
  } else {
    await prisma.payoutMethod.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
