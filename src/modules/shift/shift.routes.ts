import { Router } from "express";
import * as shiftController from "./shift.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = Router();

// Cashier apni khud ki shift open/close/dekh sakta hai
router.post("/open", verifyToken, checkPermission("shift:manage"), shiftController.openShift);
router.get("/active", verifyToken, checkPermission("shift:manage"), shiftController.getActiveShift);
router.patch("/:id/close", verifyToken, checkPermission("shift:manage"), shiftController.closeShift);

// Manager/Admin — sab shifts ka history dekh sakte hain
router.get("/", verifyToken, checkPermission("shift:view:all"), shiftController.listShifts);

export default router;