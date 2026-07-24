import { Request, Response } from "express";
import * as authService from "./auth.service.js";

export async function registerUser(req: Request, res: Response) {
  try {
    const { name, phone, email, password, role } = req.body;

    if (!name || !phone || !password || !role) {
      return res.status(400).json({
        message: "name, phone, password, and role are required",
      });
    }

    const user = await authService.registerService({ name, phone, email, password, role });

    return res.status(201).json({
      message: "User registered successfully",
      data: user,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function loginUser(req: Request, res: Response) {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        message: "phone and password are required",
      });
    }

    const result = await authService.loginService({ phone, password });

    return res.status(200).json({
      message: "Login successful",
      data: result,
    });
  } catch (error: any) {
    return res.status(401).json({ message: error.message });
  }
}

export async function refreshAccessToken(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "refreshToken is required" });
    }

    const result = await authService.refreshAccessTokenService(refreshToken);
    return res.status(200).json({ message: "Token refreshed", data: result });
  } catch (error: any) {
    return res.status(401).json({ message: error.message });
  }
}

export async function logoutUser(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "refreshToken is required" });
    }

    const result = await authService.logoutService(refreshToken);
    return res.status(200).json({ message: result.message });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}