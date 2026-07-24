import { Router } from "express";
import * as settingsController from "./settings.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = Router();

router.get("/", settingsController.getStoreSettings); // public
router.put("/", verifyToken, checkPermission("settings:update"), settingsController.upsertStoreSettings); // Admin only

export default router;