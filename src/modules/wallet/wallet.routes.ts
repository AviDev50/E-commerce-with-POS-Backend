import { Router } from "express";
import * as controller from "./wallet.controller.js";
import { verifyCustomerToken } from "../../middlewares/customerAuth.middleware.js";

const router = Router();
router.use(verifyCustomerToken);

router.get("/", controller.getMyWallet);
router.get("/transactions", controller.getMyWalletTransactions);

export default router;