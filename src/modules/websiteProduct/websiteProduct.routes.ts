import { Router } from "express";
import * as websiteProductController from "./websiteProduct.controller.js";
import { optionalAnyAuth } from "../../middlewares/optionalAnyAuth.middleware.js";

const router = Router();

// Public — koi auth nahi, customer bina login ke browse kare
router.get("/bestsellers", websiteProductController.getBestsellers);
router.get("/trending", websiteProductController.getTrending);
router.get("/top-rated", websiteProductController.getTopRated);
router.get(
  "/recommended",
  optionalAnyAuth,
  websiteProductController.getRecommendedProducts,
);
router.get("/filters", websiteProductController.getWebsiteProductFilters);
router.get("/", websiteProductController.getAllWebsiteProducts);
router.get("/category-deals", websiteProductController.getCategoryDeals);  
router.get("/:slug", websiteProductController.getWebsiteProductBySlug);


export default router;
