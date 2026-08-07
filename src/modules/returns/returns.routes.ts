import { Router } from "express";
import * as controller from "./returns.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = Router();

router.use(verifyToken);

router.get("/", checkPermission("return:view"), controller.listReturns);
router.get("/:id", checkPermission("return:view"), controller.getReturnById);
router.patch("/:id/approve", checkPermission("return:manage"), controller.approveReturn);
router.patch("/:id/reject", checkPermission("return:manage"), controller.rejectReturn);
router.patch("/:id/schedule-pickup", checkPermission("return:manage"), controller.schedulePickup);
router.patch("/:id/receive", checkPermission("return:manage"), controller.markReceived);
router.patch("/:id/refund", checkPermission("return:manage"), controller.processRefund);
router.patch("/:id/exchange", checkPermission("return:manage"), controller.processExchange);

export default router;