import { Request, Response } from "express";
import { registerService, loginService } from "./auth.service";

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { name, phone, email, password, role } = req.body;

    if (!name || !phone || !password || !role) {
      return res.status(400).json({
        message: "name, phone, password, and role are required",
      });
    }

    const user = await registerService({ name, phone, email, password, role });

    return res.status(201).json({
      message: "User registered successfully",
      data: user,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        message: "phone and password are required",
      });
    }

    const result = await loginService({ phone, password });

    return res.status(200).json({
      message: "Login successful",
      data: result,
    });
  } catch (error: any) {
    return res.status(401).json({ message: error.message });
  }
};