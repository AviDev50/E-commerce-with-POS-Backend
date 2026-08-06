import { Router } from "express";
import * as customerProfileController from "./customerProfile.controller.js";
import {verifyCustomerToken} from "../../middlewares/customerAuth.middleware.js"

const router = Router();

router.get("/", verifyCustomerToken, customerProfileController.getProfile);
router.put("/", verifyCustomerToken, customerProfileController.updateProfile);
router.delete("/", verifyCustomerToken, customerProfileController.deleteProfile);

export default router;