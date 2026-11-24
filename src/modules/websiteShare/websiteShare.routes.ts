import { Router } from "express";
import * as shareController from "./websiteShare.controller.js";

// JSON: /api/v1/website/share/product/:slug
const router = Router();
router.get("/product/:slug", shareController.getProductShareData);

// HTML: /share/product/:slug
export const sharePageRoutes = Router();
sharePageRoutes.get("/product/:slug", shareController.renderProductSharePage);

export default router;