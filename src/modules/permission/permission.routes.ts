import { Router } from "express";
import * as permissionController from "./permission.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import { Role } from "@prisma/client";

const router = Router();

// NAYA: har logged-in staff (kisī bhi role) apni khud ki permissions dekh sakta hai
router.get("/my", verifyToken, permissionController.getMyPermissions);

// Sirf ADMIN — baaki sab management routes (assign/revoke/kisi bhi role ki list)
router.use(verifyToken, authorizeRoles(Role.ADMIN));

router.get("/", permissionController.getAllPermissions);
router.get("/role/:role", permissionController.getPermissionsByRole);
router.post("/assign", permissionController.assignPermission);
router.post("/revoke", permissionController.revokePermission);

export default router;
