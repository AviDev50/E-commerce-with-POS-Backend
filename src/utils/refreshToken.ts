import crypto from "crypto";

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getRefreshTokenExpiry(): Date {
  const days = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 30;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}