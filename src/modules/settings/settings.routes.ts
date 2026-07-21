import { Router } from "express";
import * as settingsController from "./settings.controller";
import { verifyToken } from "../../middlewares/auth.middleware";
import { checkPermission } from "../../middlewares/permission.middleware";

const router = Router();

router.get("/", settingsController.getStoreSettings); // public
router.put("/", verifyToken, checkPermission("settings:update"), settingsController.upsertStoreSettings); // Admin only

export default router;