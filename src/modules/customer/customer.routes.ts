import { Router } from "express";
import * as customerController from "./customer.controller.js";

const router = Router();

router.post("/register", customerController.registerCustomer);
router.post("/login", customerController.loginCustomer);
router.post("/refresh", customerController.refreshCustomerAccessToken);
router.post("/logout", customerController.logoutCustomer);

export default router;
