import { Router } from "express";
import * as couponController from "./coupon.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";
import { verifyCustomerToken } from "../../middlewares/customerAuth.middleware.js";

const router = Router();

router.use(verifyToken); // login zaroori sabke liye

router.get("/", checkPermission("coupon:read"), couponController.getAllCoupons);
router.get(
  "/:id",
  checkPermission("coupon:read"),
  couponController.getCouponById,
);
router.post(
  "/",
  checkPermission("coupon:create"),
  couponController.createCoupon,
);
router.put(
  "/:id",
  checkPermission("coupon:update"),
  couponController.updateCoupon,
);
router.delete(
  "/:id",
  checkPermission("coupon:delete"),
  couponController.deleteCoupon,
);
router.post("/validate", verifyCustomerToken, couponController.validateCoupon); //customer side
router.get("/active", verifyCustomerToken,couponController.getActiveCoupons);

export default router;
