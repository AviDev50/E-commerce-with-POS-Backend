import { Router } from "express";
import * as cartController from "./cart.controller.js";
import { verifyCustomerToken } from "../../middlewares/customerAuth.middleware.js";

const router = Router();

// Sab routes protected — sirf logged-in customer apna cart access kar sakta hai
router.get("/", verifyCustomerToken, cartController.getCart);
router.post("/items", verifyCustomerToken, cartController.addToCart);
router.patch("/items/:id", verifyCustomerToken, cartController.updateCartItem);
router.delete("/items/:id", verifyCustomerToken, cartController.removeCartItem);
router.delete("/", verifyCustomerToken, cartController.clearCart);

export default router;