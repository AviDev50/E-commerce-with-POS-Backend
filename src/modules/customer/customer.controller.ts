import { Request, Response } from "express";
import * as customerService from "./customer.service.js";

// ==================== REGISTER CUSTOMER ====================
export async function registerCustomer(req: Request, res: Response) {
  try {
    const { name, phone, email, password, dob, gender } = req.body;

    if (!name || !phone || !password || !dob || !gender) {
      return res.status(400).json({
        message: "name, phone, password, dob, and gender are required",
      });
    }

    const customer = await customerService.registerCustomerService({
      name,
      phone,
      email,
      password,
      dob,
      gender,
    });

    return res.status(201).json({ message: "Customer registered successfully", data: customer });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Something went wrong" });
  }
}

export async function loginCustomer(req: Request, res: Response) {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: "phone and password are required" });
    }

    const result = await customerService.loginCustomerService({ phone, password });
    return res.status(200).json({ message: "Login successful", data: result });
  } catch (error: any) {
    return res.status(401).json({ message: error.message });
  }
}

export async function refreshCustomerAccessToken(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "refreshToken is required" });
    }

    const result = await customerService.refreshCustomerAccessTokenService(refreshToken);
    return res.status(200).json({ message: "Token refreshed", data: result });
  } catch (error: any) {
    return res.status(401).json({ message: error.message });
  }
}

export async function logoutCustomer(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "refreshToken is required" });
    }

    const result = await customerService.logoutCustomerService(refreshToken);
    return res.status(200).json({ message: result.message });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}