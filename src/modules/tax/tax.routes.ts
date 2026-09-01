import { Router } from "express";
import * as taxController from "./tax.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import { Role } from "@prisma/client";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = Router();

// Sirf ADMIN — tax config business-critical hai
router.use(verifyToken, authorizeRoles(Role.ADMIN));

router.post("/classes", checkPermission("tax:manage"),taxController.createTaxClass);
router.get("/classes", checkPermission("tax:manage"),taxController.getAllTaxClasses);
router.delete("/classes/:id", checkPermission("tax:manage"),taxController.deleteTaxClass);
router.put("/classes/:id", checkPermission("tax:manage"),taxController.updateTaxClass);
router.post("/rates", checkPermission("tax:manage"),taxController.createTaxRate);
router.get("/rates/:taxClassId", checkPermission("tax:manage"), checkPermission("tax:manage"),taxController.getTaxRatesByClass);
router.delete("/rates/:id", checkPermission("tax:manage"),taxController.deleteTaxRate);
router.put("/rates/:id", checkPermission("tax:manage"),taxController.updateTaxRate);
router.post(
  "/provision-default",
  checkPermission("tax:manage"), // ya jo bhi existing tax permission key hai tumhare tax module mein
  taxController.provisionDefaultTax,
);

export default router;