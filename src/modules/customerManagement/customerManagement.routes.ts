import { Router } from "express";
import * as customerManagementController from "./customerManagement.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = Router();

router.get(
  "/search",
  verifyToken,
  checkPermission("customer:search"),
  customerManagementController.searchCustomer,
);

router.post(
  "/quick-create",
  verifyToken,
  checkPermission("customer:create"),
  customerManagementController.quickCreateCustomer,
);

router.get(
  "/",
  verifyToken,
  checkPermission("customer:read"),
  customerManagementController.getAllCustomers,
);

export default router;
