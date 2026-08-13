import { Router } from "express";
import * as websiteSearchController from "./websiteSearch.controller.js";

const router = Router();

// Public — koi auth nahi
router.get("/suggestions", websiteSearchController.getSearchSuggestions);

export default router;