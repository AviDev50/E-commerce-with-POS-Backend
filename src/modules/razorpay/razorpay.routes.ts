import { Router } from "express";
import * as razorpayController from "./razorpay.controller.js";
import { verifyCustomerToken } from "../../middlewares/customerAuth.middleware.js"; // ⚠️ apna actual path daalo

const router = Router();

router.post(
  "/create-order",
  verifyCustomerToken,
  razorpayController.createRazorpayOrder,
);
router.post(
  "/verify",
  verifyCustomerToken,
  razorpayController.verifyRazorpayPayment,
);
router.post("/webhook", razorpayController.razorpayWebhook); // ⚠️ public — Razorpay khud call karega, koi customer token nahi hoga

export default router;
