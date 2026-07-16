import { Router } from "express";
import * as categoryController from "./category.controller";
import { verifyToken } from "../../middlewares/auth.middleware";
import { checkPermission } from "../../middlewares/permission.middleware";

const router = Router();

// Public — customer bhi category browse kar sake
router.get("/", categoryController.getAllCategories);
router.get("/:id", categoryController.getCategoryById);

// Protected — staff only
router.post("/", verifyToken, checkPermission("category:create"), categoryController.createCategory);
router.put("/:id", verifyToken, checkPermission("category:update"), categoryController.updateCategory);
router.delete("/:id", verifyToken, checkPermission("category:delete"), categoryController.deleteCategory);

export default router;