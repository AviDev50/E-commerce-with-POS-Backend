import { Router } from "express";
import {
  createAttribute,
  getAllAttributes,
  addAttributeValue,
  deleteAttributeValue,
  deleteAttribute,
} from "./attribute.controller.js";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = Router();

router.use(verifyToken); // login required for all routes

router.get("/", checkPermission("attribute:read"), getAllAttributes);
router.post("/", checkPermission("attribute:create"), createAttribute);
router.post("/value", checkPermission("attribute:create"), addAttributeValue);
router.delete(
  "/value/:id",
  checkPermission("attribute:delete"),
  deleteAttributeValue,
);
router.delete("/:id", checkPermission("attribute:delete"), deleteAttribute);

export default router;
