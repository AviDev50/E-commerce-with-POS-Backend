import { Router } from "express";
import * as orderController from "./order.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { verifyCustomerToken } from "../../middlewares/customerAuth.middleware.js";
import { verifyAnyToken } from "../../middlewares/anyAuth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = Router();

// Online — customer only
router.post("/online", verifyCustomerToken, orderController.createOnlineOrder);
router.post(
  "/preview",
  verifyCustomerToken,
  orderController.previewOnlineOrder,
);
router.post("/:id/cancel", verifyCustomerToken, orderController.cancelOrder);

// POS — staff only
router.post(
  "/pos",
  verifyToken,
  checkPermission("order:create:pos"),
  orderController.createPosOrder,
);

router.get("/:id/receipt", verifyAnyToken, orderController.getOrderReceipt);

// Shared — staff ya customer dono access kar sakte hain (controller ke andar filter/authorize hota hai)
router.get("/", verifyAnyToken, orderController.getAllOrders);
router.get("/:id", verifyAnyToken, orderController.getOrderById);

// Staff only — status update & refund
router.patch(
  "/:id/status",
  verifyToken,
  checkPermission("order:update"),
  orderController.updateOrderStatus,
);

router.post(
  "/:id/refund",
  verifyToken,
  checkPermission("order:refund"),
  orderController.refundOrder,
);

router.get(
  "/pos/history",
  verifyToken,
  checkPermission("order:read"),
  orderController.getPosOrderHistory,
);

router.post(
  "/pos/exchange/preview",
  verifyToken,
  checkPermission("order:exchange:pos"),
  orderController.previewPosExchange,
);

router.post(
  "/pos/exchange",
  verifyToken,
  checkPermission("order:exchange:pos"),
  orderController.instantPosExchange,
);

export default router;
