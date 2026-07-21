import { Router } from "express";
import * as productController from "./product.controller";
import { verifyToken } from "../../middlewares/auth.middleware";
import { checkPermission } from "../../middlewares/permission.middleware";
import { optionalAuth } from "../../middlewares/optionalAuth.middleware";
import { upload } from "../../middlewares/upload.middleware";

const router = Router();

// Public — customer bhi dekh sakta hai
router.get("/", optionalAuth, productController.getAllProducts);
router.get("/:id/variants", productController.getVariantsByProduct);
router.get("/:id", productController.getProductById);

// Protected — staff only
router.post(
  "/",
  verifyToken,
  checkPermission("product:create"),
  upload.array("images", 5),
  productController.createProduct,
);
router.put(
  "/:id",
  verifyToken,
  checkPermission("product:update"),
  upload.array("images", 5),
  productController.updateProduct,
);
router.delete(
  "/:id",
  verifyToken,
  checkPermission("product:delete"),
  productController.deleteProduct,
);

router.post(
  "/:id/variants",
  verifyToken,
  checkPermission("product:create"),
  productController.createVariant,
);

router.post(
  "/:id/variants/generate",
  verifyToken,
  checkPermission("product:create"),
  productController.generateVariants,
);

router.delete(
  "/variants/:variantId",
  verifyToken,
  checkPermission("product:delete"),
  productController.deleteVariant,
);

export default router;
