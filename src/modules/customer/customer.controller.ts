import { Request, Response } from "express";
import * as customerService from "./customer.service.js";

const PHONE_REGEX = /^[6-9]\d{9}$/;
const OTP_REGEX = /^\d{4,6}$/;

const isValidPhone = (v: unknown): v is string =>
  typeof v === "string" && PHONE_REGEX.test(v);

// ==================== OTP ====================
export async function requestCustomerOtp(req: Request, res: Response) {
  try {
    const { phone } = req.body;
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: "Valid 10-digit phone is required" });
    }
    const result = await customerService.requestCustomerOtpService(phone);
    return res.status(200).json(result);
  } catch (error: any) {
    return res
      .status(error.statusCode || 500)
      .json({ message: error.message || "Something went wrong" });
  }
}

export async function verifyCustomerOtp(req: Request, res: Response) {
  try {
    const { phone, otp, name } = req.body;
    if (
      !isValidPhone(phone) ||
      (typeof otp !== "string" && typeof otp !== "number") ||
      !OTP_REGEX.test(String(otp))
    ) {
      return res.status(400).json({ message: "phone and otp are required" });
    }

    let cleanName: string | undefined;
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
        return res.status(400).json({ message: "Invalid name" });
      }
      cleanName = name.trim();
    }

    const result = await customerService.verifyCustomerOtpService(
      phone,
      String(otp),
      cleanName,
    );
    return res.status(200).json({ message: "Login successful", data: result });
  } catch (error: any) {
    return res
      .status(error.statusCode || 401)
      .json({ message: error.message });
  }
}

// ==================== REGISTER CUSTOMER ====================
export async function registerCustomer(req: Request, res: Response) {
  try {
    const { name, phone, email, password } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({
        message: "name, phone, password are required",
      });
    }

    const customer = await customerService.registerCustomerService({
      name,
      phone,
      email,
      password,
    });

    return res
      .status(201)
      .json({ message: "Customer registered successfully", data: customer });
  } catch (error: any) {
    return res
      .status(error.statusCode || 500)
      .json({ message: error.message || "Something went wrong" });
  }
}

export async function loginCustomer(req: Request, res: Response) {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res
        .status(400)
        .json({ message: "phone and password are required" });
    }

    const result = await customerService.loginCustomerService({
      phone,
      password,
    });
    return res.status(200).json({ message: "Login successful", data: result });
  } catch (error: any) {
    return res.status(error.statusCode || 401).json({ message: error.message });
  }
}

export async function refreshCustomerAccessToken(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "refreshToken is required" });
    }

    const result =
      await customerService.refreshCustomerAccessTokenService(refreshToken);
    return res.status(200).json({ message: "Token refreshed", data: result });
  } catch (error: any) {
    return res.status(error.statusCode || 401).json({ message: error.message });
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