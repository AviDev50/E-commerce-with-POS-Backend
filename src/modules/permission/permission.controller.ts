import { Request, Response } from "express";
import * as permissionService from "./permission.service";
import { Role } from "@prisma/client";

export async function getAllPermissions(_req: Request, res: Response) {
  try {
    const permissions = await permissionService.getAllPermissionsService();
    return res.status(200).json({ data: permissions });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getPermissionsByRole(req: Request, res: Response) {
  try {
    const role = req.params.role as Role;

    if (!Object.values(Role).includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const permissions = await permissionService.getPermissionsByRoleService(role);
    return res.status(200).json({ data: permissions });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function assignPermission(req: Request, res: Response) {
  try {
    const { role, permissionKey } = req.body;

    if (!role || !permissionKey) {
      return res.status(400).json({ message: "role and permissionKey are required" });
    }

    if (!Object.values(Role).includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const result = await permissionService.assignPermissionService(role, permissionKey);
    return res.status(201).json({ message: "Permission assigned", data: result });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function revokePermission(req: Request, res: Response) {
  try {
    const { role, permissionKey } = req.body;

    if (!role || !permissionKey) {
      return res.status(400).json({ message: "role and permissionKey are required" });
    }

    if (!Object.values(Role).includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const result = await permissionService.revokePermissionService(role, permissionKey);
    return res.status(200).json({ message: "Permission revoked", data: result });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}