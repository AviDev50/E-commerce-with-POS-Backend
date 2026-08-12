import { Router } from "express";
import * as websiteSupportController from "./websiteSupport.controller.js";
import { verifyCustomerToken } from "../../middlewares/customerAuth.middleware.js"; // ⚠️ apna actual path daalo

const router = Router();

// Sab protected — login mandatory
router.post("/", verifyCustomerToken, websiteSupportController.createSupportTicket);
router.get("/", verifyCustomerToken, websiteSupportController.getMySupportTickets);
router.get("/:id", verifyCustomerToken, websiteSupportController.getMySupportTicketById);

export default router;