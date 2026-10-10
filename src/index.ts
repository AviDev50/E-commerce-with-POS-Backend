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
import cartRoutes from "./modules/carts/cart.routes.js";
import bannerRoutes from "./modules/banner/banner.routes.js";
import websiteBannerRoutes from "./modules/websiteBanner/websiteBanner.routes.js";
import wishlistRoutes from "./modules/wishlist/wishlist.routes.js";
import taxRoutes from "./modules/tax/tax.routes.js";
import customerProfileRoutes from "./modules/customerProfile/customerProfile.routes.js";
import returnsRoutes from "./modules/returns/returns.routes.js";
import websiteReturnsRoutes from "./modules/websiteReturns/websiteReturns.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import customerManagementRoutes from "./modules/customerManagement/customerManagement.routes.js";
import staffManagementRoutes from "./modules/staffManagement/staff.routes.js";
import supportRoutes from "./modules/support/support.routes.js";
import websiteSupportRoutes from "./modules/websiteSupport/websiteSupport.routes.js";
import pageRoutes from "./modules/page/page.routes.js";
import websitePageRoutes from "./modules/websitePage/websitePage.routes.js";
import websiteSearchRoutes from "./modules/websiteSearch/websiteSearch.routes.js";
import reportsRoutes from "./modules/reports/reports.routes.js";
import shiftRoutes from "./modules/shift/shift.routes.js";
import heldOrderRoutes from "./modules/heldOrder/heldOrder.routes.js";
import razorpayRoutes from "./modules/razorpay/razorpay.routes.js";
import walletRoutes from "./modules/wallet/wallet.routes.js"

// __dirname replacement for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf; // webhook controller isko use karega signature verify ke liye
    },
  }),
);
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

//admin panel website routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/attributes", attributeRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/addresses", addressRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/permissions", permissionRoutes);
app.use("/api/v1/coupons", couponRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/customer", customerRoutes);
app.use("/api/v1/banners", bannerRoutes);
app.use("/api/v1/tax", taxRoutes);
app.use("/api/v1/customer/profile", customerProfileRoutes);
app.use("/api/v1/support", supportRoutes);
app.use("/api/v1/returns", returnsRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/pages", pageRoutes);
app.use("/api/v1/staff", staffManagementRoutes);

//E-Commerce website Routes
app.use("/api/v1/website/cart", cartRoutes);
app.use("/api/v1/website/banners", websiteBannerRoutes);
app.use("/api/v1/websiteProducts", websiteProductRoutes);
app.use("/api/v1/website/wishlist", wishlistRoutes);
app.use("/api/v1/website/returns", websiteReturnsRoutes);
app.use("/api/v1/website/support", websiteSupportRoutes);
app.use("/api/v1/website/pages", websitePageRoutes);
app.use("/api/v1/website/search", websiteSearchRoutes);
app.use("/api/v1/website/payments/razorpay", razorpayRoutes);
app.use("/api/v1/website/wallet", walletRoutes);

//pos panel website routes
app.use("/api/v1/pos/customers", customerManagementRoutes);
app.use("/api/v1/pos/reports", reportsRoutes);
app.use("/api/v1/pos/shifts", shiftRoutes);
app.use("/api/v1/pos/held-orders", heldOrderRoutes);

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});





