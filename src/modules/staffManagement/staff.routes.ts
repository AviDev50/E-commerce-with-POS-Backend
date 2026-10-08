import { Router } from "express";
import * as staffController from "./staff.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = Router();

router.get("/", verifyToken, checkPermission("staff:view"), staffController.listStaff);
router.get("/:id", verifyToken, checkPermission("staff:view"), staffController.getStaffById);
router.patch("/:id/deactivate", verifyToken, checkPermission("staff:manage"), staffController.deactivateStaff);
router.patch("/:id/activate", verifyToken, checkPermission("staff:manage"), staffController.activateStaff);
router.patch("/:id/role", verifyToken, checkPermission("staff:manage"), staffController.changeStaffRole);//currently not using in real admin panel

export default router;