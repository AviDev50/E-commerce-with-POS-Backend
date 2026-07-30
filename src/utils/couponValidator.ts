import { Coupon } from "@prisma/client";

export function computeCouponDiscount(coupon: Coupon, subtotal: number) {
  if (!coupon.isActive) {
    throw new Error("This coupon is not active");
  }
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new Error("Coupon has expired");
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw new Error("Coupon usage limit reached");
  }
  if (coupon.minOrderValue && subtotal < Number(coupon.minOrderValue)) {
    throw new Error(
      `Minimum order value for this coupon is ${coupon.minOrderValue}`,
    );
  }

  let discount =
    coupon.discountType === "PERCENTAGE"
      ? (subtotal * Number(coupon.value)) / 100
      : Number(coupon.value);

  return Math.min(discount, subtotal);
}
