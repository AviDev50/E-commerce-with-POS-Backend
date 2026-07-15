import { Router } from "express";
import { registerUser, loginUser } from "./auth.controller";
import { verifyToken } from "../../middlewares/auth.middleware";
import { authorizeRoles } from "../../middlewares/role.middleware";
import { Role } from "@prisma/client";

const router = Router();

router.post("/register", verifyToken, authorizeRoles(Role.ADMIN), registerUser);
router.post("/login", loginUser);

export default router;