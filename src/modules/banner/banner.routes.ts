import { Router } from "express";
import * as bannerController from "./banner.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";

const router = Router();

// Admin only — sab protected, staff permission required
router.get(
  "/",
  verifyToken,
  checkPermission("banner:read"),
  bannerController.getAllBanners,
);
router.get(
  "/:id",
  verifyToken,
  checkPermission("banner:read"),
  bannerController.getBannerById,
);
router.post(
  "/",
  verifyToken,
  checkPermission("banner:create"),
  upload.single("image"),
  bannerController.createBanner,
);
router.put(
  "/:id",
  verifyToken,
  checkPermission("banner:update"),
  upload.single("image"),
  bannerController.updateBanner,
);
router.delete(
  "/:id",
  verifyToken,
  checkPermission("banner:delete"),
  bannerController.deleteBanner,
);

export default router;
