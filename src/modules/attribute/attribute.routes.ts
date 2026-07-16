import { Router } from "express";
import {
  createAttribute,
  getAllAttributes,
  addAttributeValue,
  deleteAttributeValue,
  deleteAttribute,
} from "./attribute.controller";
import { verifyToken } from "../../middlewares/auth.middleware";
import { checkPermission } from "../../middlewares/permission.middleware";

const router = Router();

router.use(verifyToken); // saare routes ke liye login zaroori

router.get("/", checkPermission("attribute:read"), getAllAttributes);
router.post("/", checkPermission("attribute:create"), createAttribute);
router.post("/value", checkPermission("attribute:create"), addAttributeValue);
router.delete("/value/:id", checkPermission("attribute:delete"), deleteAttributeValue);
router.delete("/:id", checkPermission("attribute:delete"), deleteAttribute);

export default router;