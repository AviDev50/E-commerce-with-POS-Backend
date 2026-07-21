import { Router } from "express";
import * as couponController from "./coupon.controller";
import { verifyToken } from "../../middlewares/auth.middleware";
import { checkPermission } from "../../middlewares/permission.middleware";

const router = Router();

router.use(verifyToken); // login zaroori sabke liye

router.get("/", checkPermission("coupon:read"), couponController.getAllCoupons);
router.get("/:id", checkPermission("coupon:read"), couponController.getCouponById);
router.post("/", checkPermission("coupon:create"), couponController.createCoupon);
router.put("/:id", checkPermission("coupon:update"), couponController.updateCoupon);
router.delete("/:id", checkPermission("coupon:delete"), couponController.deleteCoupon);

export default router;