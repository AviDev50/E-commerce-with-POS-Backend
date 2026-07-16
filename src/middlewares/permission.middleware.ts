import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";

export const checkPermission = (permissionKey: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const hasPermission = await prisma.rolePermission.findFirst({
        where: {
          role: req.user.role,
          permission: { key: permissionKey },
        },
      });

      if (!hasPermission) {
        return res.status(403).json({
          message: `You do not have permission to perform this action (${permissionKey})`,
        });
      }

      return next();
    } catch (error) {
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
};