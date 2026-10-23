import { Router } from "express";
import * as controller from "./pos-page.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = Router();

// Public: React website ke liye (login nahi chahiye)
router.get("/public/:type", controller.getPublicPosPage);

// Authenticated: admin / POS panel
router.get("/", verifyToken, checkPermission("pos_page:read"), controller.getAllPosPages);
router.get("/:type", verifyToken, checkPermission("pos_page:read"), controller.getPosPageByType);
router.put("/:type", verifyToken, checkPermission("pos_page:update"), controller.upsertPosPage);

export default router;