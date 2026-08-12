import { Router } from "express";
import * as supportController from "./support.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = Router();

router.get("/", verifyToken, checkPermission("support:read"), supportController.getAllSupportTickets);
router.get("/:id", verifyToken, checkPermission("support:read"), supportController.getSupportTicketById);
router.patch("/:id/status", verifyToken, checkPermission("support:update"), supportController.updateSupportTicketStatus);

export default router;