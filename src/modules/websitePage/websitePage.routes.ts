import { Router } from "express";
import * as websitePageController from "./websitePage.controller.js";

const router = Router();

// Public — koi auth nahi
router.get("/", websitePageController.getAllWebsitePages);
router.get("/:type", websitePageController.getWebsitePageByType);

export default router;