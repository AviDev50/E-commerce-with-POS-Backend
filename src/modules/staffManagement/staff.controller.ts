import { Request, Response } from "express";
import * as staffService from "./staff.service.js";

export async function listStaff(req: Request, res: Response) {
  try {
    const { role, isActive } = req.query;
    const staff = await staffService.listStaffService({
      role: role as string | undefined,
      isActive: isActive === undefined ? undefined : isActive === "true",
    });
    return res.status(200).json({ message: "Staff fetched", data: staff });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}

export async function getStaffById(req: Request<{ id: string }>, res: Response) {
  try {
    const staff = await staffService.getStaffByIdService(req.params.id);
    return res.status(200).json({ message: "Staff fetched", data: staff });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}

export async function deactivateStaff(req: Request<{ id: string }>, res: Response) {
  try {
    const staff = await staffService.deactivateStaffService(req.params.id, req.user!.id);
    return res.status(200).json({ message: "Staff deactivated", data: staff });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}

export async function activateStaff(req: Request<{ id: string }>, res: Response) {
  try {
    const staff = await staffService.activateStaffService(req.params.id);
    return res.status(200).json({ message: "Staff activated", data: staff });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}

export async function changeStaffRole(req: Request<{ id: string }>, res: Response) {
  try {
    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ message: "role is required" });
    }
    const staff = await staffService.changeStaffRoleService(req.params.id, role, req.user!.id);
    return res.status(200).json({ message: "Role updated", data: staff });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}