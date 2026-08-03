import { Router } from "express";
import * as websiteBannerController from "./websiteBanner.controller.js";

const router = Router();

// Public — koi auth nahi, customer/app home page ke liye
router.get("/", websiteBannerController.getActiveBanners);

export default router;