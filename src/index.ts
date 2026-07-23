import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";
import authRoutes from "./modules/auth/auth.routes";
import path from "path";
import attributeRoutes from "./modules/attribute/attribute.routes";
import websiteProductRoutes from "./modules/product/product.routes";
import categoryRoutes from "./modules/category/category.routes";
import orderRoutes from "./modules/order/order.routes";
import addressRoutes from "./modules/address/address.routes";
import settingsRoutes from "./modules/settings/settings.routes";
import permissionRoutes from "./modules/permission/permission.routes";
import couponRoutes from "./modules/coupon/coupon.routes";
import reviewRoutes from "./modules/review/review.routes";
import customerRoutes from "./modules/customer/customer.routes";
import productRoutes from "./modules/product/product.routes";


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/attributes", attributeRoutes);
app.use("/api/products", productRoutes);
app.use("/api/websiteProducts", websiteProductRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/customer", customerRoutes);


app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});