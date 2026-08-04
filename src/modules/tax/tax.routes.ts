import { Router } from "express";
import * as taxController from "./tax.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import { Role } from "@prisma/client";

const router = Router();

// Sirf ADMIN — tax config business-critical hai
router.use(verifyToken, authorizeRoles(Role.ADMIN));

router.post("/classes", taxController.createTaxClass);
router.get("/classes", taxController.getAllTaxClasses);
router.delete("/classes/:id", taxController.deleteTaxClass);

router.post("/rates", taxController.createTaxRate);
router.get("/rates/:taxClassId", taxController.getTaxRatesByClass);
router.delete("/rates/:id", taxController.deleteTaxRate);

export default router;