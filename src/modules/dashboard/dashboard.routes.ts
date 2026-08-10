import { Router } from "express";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";
import * as dashboardController from "./dashboard.controller.js";

const router = Router();

router.get("/summary", verifyToken, checkPermission("dashboard:view"), dashboardController.getSummary);

export default router;