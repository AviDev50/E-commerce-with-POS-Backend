import { Router } from "express";
import * as websiteProductController from "./websiteProduct.controller.js";

const router = Router();

// Public — koi auth nahi, customer bina login ke browse kare
router.get("/bestsellers", websiteProductController.getBestsellers);
router.get("/trending", websiteProductController.getTrending);
router.get("/top-rated", websiteProductController.getTopRated);
router.get("/filters", websiteProductController.getWebsiteProductFilters); // ⚠️ /:slug se pehle rakha hai warna "filters" slug maana jaayega
router.get("/", websiteProductController.getAllWebsiteProducts);
router.get("/:slug", websiteProductController.getWebsiteProductBySlug);

export default router;