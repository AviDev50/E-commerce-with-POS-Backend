import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface CustomerJwtPayload {
  id: string;
  type: string;
}

export function verifyCustomerToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as CustomerJwtPayload;

    if (decoded.type !== "customer") {
      return res.status(403).json({ message: "Invalid token type — customer token required" });
    }

    req.customer = { id: decoded.id };
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}