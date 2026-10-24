import { Router } from "express";
import * as reportsController from "./reports.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";
// import { OrderStatus, OrderChannel, ReturnType, ReturnStatus, Prisma } from "@prisma/client";

const router = Router();

router.get(
  "/sales/daily",
  verifyToken,
  checkPermission("report:sales:view"),
  reportsController.getDailySalesReport,
);

router.get(
  "/returns-exchanges",
  verifyToken,
  // checkPermission("report:returns:view"),
  checkPermission("report:sales:view"),
  reportsController.getReturnsExchangeReport,
);

export default router;
