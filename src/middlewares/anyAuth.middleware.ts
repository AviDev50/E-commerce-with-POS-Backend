import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";

interface AnyJwtPayload {
  id: string;
  role?: Role;
  type?: string;
}

export function verifyAnyToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as AnyJwtPayload;

    if (decoded.type === "customer") {
      req.customer = { id: decoded.id };
    } else if (decoded.role) {
      req.user = { id: decoded.id, role: decoded.role };
    } else {
      return res.status(401).json({ message: "Invalid token" });
    }

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}