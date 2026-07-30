import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";

interface AnyJwtPayload {
  id: string;
  role?: Role;
  type?: string;
}

export function optionalAnyAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET as string,
      ) as AnyJwtPayload;
      if (decoded.type === "customer") {
        req.customer = { id: decoded.id };
      } else if (decoded.role) {
        req.user = { id: decoded.id, role: decoded.role };
      }
    } catch {
      // Invalid token — guest treat karo, error mat do
    }
  }

  next();
}
