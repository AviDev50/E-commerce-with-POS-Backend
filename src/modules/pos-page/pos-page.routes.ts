import { Router } from "express";
import * as controller from "./pos-page.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
// import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = Router();

router.get("/public/:type", controller.getPublicPosPage);

// Authenticated: admin / POS panel
router.get("/",controller.getAllPosPages);
router.get("/:type", controller.getPosPageByType);
router.put("/:type", verifyToken, controller.upsertPosPage);

export default router;