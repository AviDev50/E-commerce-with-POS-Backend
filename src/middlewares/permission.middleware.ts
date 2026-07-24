import { Request, Response, NextFunction } from "express";
import prisma from "../config/db.js";
import { Role } from "@prisma/client";

export async function hasPermission(role: Role, permissionKey: string): Promise<boolean> {
  const rolePermission = await prisma.rolePermission.findFirst({
    where: { role, permission: { key: permissionKey } },
  });
  return !!rolePermission;
}

export function checkPermission(permissionKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const allowed = await hasPermission(req.user.role, permissionKey);

      if (!allowed) {
        return res.status(403).json({
          message: `You do not have permission to perform this action (${permissionKey})`,
        });
      }

      return next();
    } catch (error) {
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
}