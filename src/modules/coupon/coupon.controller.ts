import { Request, Response } from "express";
import * as couponService from "./coupon.service.js";

export async function validateCoupon(req: Request, res: Response) {
  try {
    const { code, subtotal } = req.body;

    if (!code || subtotal === undefined) {
      return res
        .status(400)
        .json({ message: "code and subtotal are required" });
    }

    const result = await couponService.validateCouponService(
      code,
      Number(subtotal),
    );
    return res.status(200).json({ data: result });
  } catch (error: any) {
    return res.status(400).json({ valid: false, message: error.message });
  }
}

export async function createCoupon(req: Request, res: Response) {
  try {
    const { code, discountType, value, minOrderValue, maxUses, expiresAt } =
      req.body;

    if (!code || !discountType || !value) {
      return res
        .status(400)
        .json({ message: "code, discountType, and value are required" });
    }

    const coupon = await couponService.createCouponService({
      code,
      discountType,
      value: Number(value),
      minOrderValue: minOrderValue ? Number(minOrderValue) : undefined,
      maxUses: maxUses ? Number(maxUses) : undefined,
      expiresAt,
    });

    return res.status(201).json({ message: "Coupon created", data: coupon });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function getAllCoupons(_req: Request, res: Response) {
  try {
    const coupons = await couponService.getAllCouponsService();
    return res.status(200).json({ data: coupons });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getCouponById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const coupon = await couponService.getCouponByIdService(id);
    return res.status(200).json({ data: coupon });
  } catch (error: any) {
    return res.status(404).json({ message: error.message });
  }
}

export async function updateCoupon(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { discountType, value, minOrderValue, maxUses, expiresAt, isActive } =
      req.body;

    const coupon = await couponService.updateCouponService(id, {
      discountType,
      value: value ? Number(value) : undefined,
      minOrderValue: minOrderValue ? Number(minOrderValue) : undefined,
      maxUses: maxUses ? Number(maxUses) : undefined,
      expiresAt,
      isActive,
    });

    return res.status(200).json({ message: "Coupon updated", data: coupon });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function deleteCoupon(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    await couponService.deleteCouponService(id);
    return res.status(200).json({ message: "Coupon deleted" });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function getActiveCoupons(_req: Request, res: Response) {
  try {
    const coupons = await couponService.getActiveCouponsService();
    return res.status(200).json({ data: coupons });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
