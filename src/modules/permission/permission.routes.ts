import { Router } from "express";
import * as permissionController from "./permission.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import { Role } from "@prisma/client";

const router = Router();

// Sirf ADMIN — Manager ko access nahi (privilege escalation se bachne ke liye)
router.use(verifyToken, authorizeRoles(Role.ADMIN));

router.get("/", permissionController.getAllPermissions);
router.get("/role/:role", permissionController.getPermissionsByRole);
router.post("/assign", permissionController.assignPermission);
router.post("/revoke", permissionController.revokePermission);

export default router;