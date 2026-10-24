import { Router } from "express";
import * as addressController from "./address.controller.js";
import { verifyCustomerToken } from "../../middlewares/customerAuth.middleware.js";

const router = Router();

router.use(verifyCustomerToken); // all routes customer-only

router.post("/", addressController.createAddress);
router.get("/", addressController.getMyAddresses);
router.get("/:id", addressController.getAddressById);
router.put("/:id", addressController.updateAddress);
router.delete("/:id", addressController.deleteAddress);

export default router;
