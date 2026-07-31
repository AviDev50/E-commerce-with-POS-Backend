import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./modules/auth/auth.routes.js";
import attributeRoutes from "./modules/attribute/attribute.routes.js";
import productRoutes from "./modules/product/product.routes.js";
import websiteProductRoutes from "./modules/websiteProduct/websiteProduct.routes.js";
import categoryRoutes from "./modules/category/category.routes.js";
import orderRoutes from "./modules/order/order.routes.js";
import addressRoutes from "./modules/address/address.routes.js";
import settingsRoutes from "./modules/settings/settings.routes.js";
import permissionRoutes from "./modules/permission/permission.routes.js";
import couponRoutes from "./modules/coupon/coupon.routes.js";
import reviewRoutes from "./modules/review/review.routes.js";
import customerRoutes from "./modules/customer/customer.routes.js";
import cartRoutes from "./modules/carts/cart.routes.js"

// __dirname replacement for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static Files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health Check
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    message: "Server is running",
  });
});

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/attributes", attributeRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/websiteProducts", websiteProductRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/addresses", addressRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/permissions", permissionRoutes);
app.use("/api/v1/coupons", couponRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/customer", customerRoutes);
app.use("/api/v1/website/cart", cartRoutes);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});