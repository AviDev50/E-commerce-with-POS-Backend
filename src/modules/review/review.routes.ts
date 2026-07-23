import { Router } from "express";
import * as reviewController from "./review.controller";
import { verifyCustomerToken } from "../../middlewares/customerAuth.middleware";
//import { verifyAnyToken } from "../../middlewares/anyAuth.middleware";
import { verifyToken } from "../../middlewares/auth.middleware";
import { checkPermission } from "../../middlewares/permission.middleware";
import { optionalAnyAuth } from "../../middlewares/optionalAnyAuth.middleware";
import { upload } from "../../middlewares/upload.middleware";

const router = Router();

// Customer — review submit
router.post("/", verifyCustomerToken, upload.array("images", 3), reviewController.createReview);

// Public/optional-auth — product ke reviews dekhna
router.get("/product/:productId", optionalAnyAuth, reviewController.getReviewsByProduct);

// Staff — moderate
router.patch("/:id/moderate", verifyToken, checkPermission("review:moderate"), reviewController.moderateReview);

// Combined — staff (permission check) ya customer (apna review)
router.delete("/:id", optionalAnyAuth, reviewController.deleteReview);

export default router;