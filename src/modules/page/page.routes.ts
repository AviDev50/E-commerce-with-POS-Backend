import { Router } from "express";
import * as pageController from "./page.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = Router();

router.get("/", verifyToken, checkPermission("page:read"), pageController.getAllPages);
router.get("/:type", verifyToken, checkPermission("page:read"), pageController.getPageByType);
router.put("/:type", verifyToken, checkPermission("page:update"), pageController.upsertPage);

export default router;