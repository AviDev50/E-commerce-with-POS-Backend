import prisma from "../../config/db";
import { DiscountType } from "@prisma/client";

interface CreateCouponInput {
  code: string;
  discountType: DiscountType;
  value: number;
  minOrderValue?: number;
  maxUses?: number;
  expiresAt?: string;
}

interface UpdateCouponInput {
  discountType?: DiscountType;
  value?: number;
  minOrderValue?: number;
  maxUses?: number;
  expiresAt?: string;
  isActive?: boolean;
}

export async function createCouponService(data: CreateCouponInput) {
  const code = data.code.toUpperCase().trim();

  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) {
    throw new Error("A coupon with this code already exists");
  }

  if (data.discountType === "PERCENTAGE" && data.value > 100) {
    throw new Error("Percentage discount cannot exceed 100");
  }

  return prisma.coupon.create({
    data: {
      code,
      discountType: data.discountType,
      value: data.value,
      minOrderValue: data.minOrderValue,
      maxUses: data.maxUses,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    },
  });
}

export async function getAllCouponsService() {
  return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getCouponByIdService(id: string) {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) {
    throw new Error("Coupon not found");
  }
  return coupon;
}

export async function updateCouponService(id: string, data: UpdateCouponInput) {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Coupon not found");
  }

  const finalDiscountType = data.discountType ?? existing.discountType;
  const finalValue = data.value ?? Number(existing.value);

  if (finalDiscountType === "PERCENTAGE" && finalValue > 100) {
    throw new Error("Percentage discount cannot exceed 100");
  }

  return prisma.coupon.update({
    where: { id },
    data: {
      ...data,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    },
  });
}

export async function deleteCouponService(id: string) {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Coupon not found");
  }

  return prisma.coupon.delete({ where: { id } });
}