import { Router } from "express";
import * as authController from "./auth.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import { Role } from "@prisma/client";

const router = Router();

router.post("/register", verifyToken, authorizeRoles(Role.ADMIN), authController.registerUser);
router.post("/login", authController.loginUser);
router.post("/refresh", authController.refreshAccessToken);
router.post("/logout", authController.logoutUser);

export default router;