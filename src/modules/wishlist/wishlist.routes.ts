import { Router } from "express";
import * as wishlistController from "./wishlist.controller.js";
import {verifyCustomerToken} from "../../middlewares/customerAuth.middleware.js"

const router = Router();

router.post("/toggle", verifyCustomerToken, wishlistController.toggleWishlist);
router.get("/", verifyCustomerToken, wishlistController.getWishlist);
router.post("/:id/move-to-cart", verifyCustomerToken, wishlistController.moveToCart);

export default router;