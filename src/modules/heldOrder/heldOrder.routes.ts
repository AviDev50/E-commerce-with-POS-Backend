import { Router } from "express";
import * as heldOrderController from "./heldOrder.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = Router();

router.post("/", verifyToken, checkPermission("order:hold"), heldOrderController.holdOrder);
router.get("/", verifyToken, checkPermission("order:hold"), heldOrderController.listHeldOrders);
router.get("/:id", verifyToken, checkPermission("order:hold"), heldOrderController.getHeldOrderById);
router.post("/:id/resume", verifyToken, checkPermission("order:hold"), heldOrderController.resumeHeldOrder);
router.delete("/:id", verifyToken, checkPermission("order:hold"), heldOrderController.cancelHeldOrder);

export default router;