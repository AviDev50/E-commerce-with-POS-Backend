import { Router } from "express";
import * as controller from "./websiteReturns.controller.js";
import { verifyCustomerToken } from "../../middlewares/customerAuth.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";

const router = Router();

router.use(verifyCustomerToken);

// Review ke pattern se — max 3 images, field name "images"
router.post("/", upload.array("images", 3), controller.createReturnRequest);
router.get("/", controller.listMyReturns);
router.get("/:id", controller.getMyReturnById);
router.patch("/:id/cancel", controller.cancelMyReturn);

export default router;