import { Router } from "express";
import * as controller from "./payoutMethods.controller.js";
import { verifyCustomerToken } from "../../middlewares/customerAuth.middleware.js";

const router = Router();
router.use(verifyCustomerToken);

router.post("/", controller.addPayoutMethod);
router.get("/", controller.listPayoutMethods);
router.delete("/:id", controller.deletePayoutMethod);

export default router;
