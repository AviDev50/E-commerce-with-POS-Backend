import { Router } from "express";
import * as categoryController from "./category.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";

const router = Router();

// Public — customer bhi category browse kar sake
router.get("/", categoryController.getAllCategories);
router.get("/:id", categoryController.getCategoryById);

// Protected — staff only

router.post(
  "/",
  verifyToken,
  checkPermission("category:create"),
  upload.single("image"),
  categoryController.createCategory,
);
router.put(
  "/:id",
  verifyToken,
  checkPermission("category:update"),
  upload.single("image"),
  categoryController.updateCategory,
);
router.delete(
  "/:id",
  verifyToken,
  checkPermission("category:delete"),
  categoryController.deleteCategory,
);

export default router;
