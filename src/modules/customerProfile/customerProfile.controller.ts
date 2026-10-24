import { Request, Response } from "express";
import * as customerProfileService from "./customerProfile.service.js";

// ==================== GET PROFILE ====================
export async function getProfile(req: Request, res: Response) {
  try {
    const customerId = (req as any).customer.id;
    const data = await customerProfileService.getProfile(customerId);
    res.status(200).json({ message: "Profile fetched successfully", data });
  } catch (error: any) {
    res
      .status(error.statusCode || 500)
      .json({ message: error.message || "Something went wrong" });
  }
}

// ==================== UPDATE PROFILE ====================
export async function updateProfile(req: Request, res: Response) {
  try {
    const customerId = (req as any).customer.id;
    const data = await customerProfileService.updateProfile(
      customerId,
      req.body,
    );
    res.status(200).json({ message: "Profile updated successfully", data });
  } catch (error: any) {
    res
      .status(error.statusCode || 500)
      .json({ message: error.message || "Something went wrong" });
  }
}

// ==================== DELETE PROFILE ====================
export async function deleteProfile(req: Request, res: Response) {
  try {
    const customerId = (req as any).customer.id;
    await customerProfileService.deleteProfile(customerId);
    res
      .status(200)
      .json({ message: "Profile deleted successfully", data: null });
  } catch (error: any) {
    res
      .status(error.statusCode || 500)
      .json({ message: error.message || "Something went wrong" });
  }
}
