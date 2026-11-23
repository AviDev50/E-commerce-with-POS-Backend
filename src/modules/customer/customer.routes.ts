import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as customerController from "./customer.controller.js";

const router = Router();

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later." },
});

router.post("/otp/request", otpRequestLimiter, customerController.requestCustomerOtp);
router.post("/otp/verify", otpVerifyLimiter, customerController.verifyCustomerOtp);

router.post("/register", customerController.registerCustomer);
router.post("/login", customerController.loginCustomer);
router.post("/refresh", customerController.refreshCustomerAccessToken);
router.post("/logout", customerController.logoutCustomer);

export default router;