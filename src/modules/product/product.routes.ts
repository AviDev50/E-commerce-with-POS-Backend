import { Router } from "express";
import * as productController from "./product.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";
import { optionalAuth } from "../../middlewares/optionalAuth.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";

const router = Router();

// Static route ko "/:id" se PEHLE rakhna hai, warna Express "/pos/search" ko
// "/:id/variants" pattern se match karne ki koshish kar sakta hai (safe practice)
router.get(
  "/pos/search",
  verifyToken,
  checkPermission("product:view:pos"),
  productController.getProductsForPos,
);

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

router.put(
  "/variants/:variantId",
  verifyToken,
  checkPermission("product:update"),
  upload.array("images", 5),
  productController.updateVariant,
);

export default router;
