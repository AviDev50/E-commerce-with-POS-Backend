import { Router } from "express";
import * as orderController from "./order.controller";
import { verifyToken } from "../../middlewares/auth.middleware";
import { verifyCustomerToken } from "../../middlewares/customerAuth.middleware";
import { verifyAnyToken } from "../../middlewares/anyAuth.middleware";
import { checkPermission } from "../../middlewares/permission.middleware";

const router = Router();

// POS — staff only
router.post("/pos", verifyToken, checkPermission("order:create:pos"), orderController.createPosOrder);

// Online — customer only
router.post("/online", verifyCustomerToken, orderController.createOnlineOrder);

// Shared — staff ya customer dono access kar sakte hain (controller ke andar filter/authorize hota hai)
router.get("/", verifyAnyToken, orderController.getAllOrders);
router.get("/:id", verifyAnyToken, orderController.getOrderById);

// Staff only — status update & refund
router.patch("/:id/status", verifyToken, checkPermission("order:update"), orderController.updateOrderStatus);
router.post("/:id/refund", verifyToken, checkPermission("order:refund"), orderController.refundOrder);

export default router;