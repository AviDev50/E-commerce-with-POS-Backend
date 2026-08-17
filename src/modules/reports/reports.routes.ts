import { Router } from "express";
import * as reportsController from "./reports.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = Router();

router.get(
  "/sales/daily",
  verifyToken,
  checkPermission("report:sales:view"),
  reportsController.getDailySalesReport,
);

export default router;