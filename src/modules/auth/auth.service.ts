import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../../config/db.js";
import { Role } from "@prisma/client";
import {
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiry,
} from "../../utils/refreshToken.js";

interface RegisterInput {
  name: string;
  phone: string;
  email?: string;
  password: string;
  role: Role;
}

interface LoginInput {
  phone: string;
  password: string;
}

function generateAccessToken(id: string, role: Role): string {
  return jwt.sign({ id, role }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.ACCESS_TOKEN_EXPIRES_IN ||
      "15m") as jwt.SignOptions["expiresIn"],
  });
}

export async function registerService(data: RegisterInput) {
  const existingUser = await prisma.user.findUnique({
    where: { phone: data.phone },
  });

  if (existingUser) {
    throw new Error("User with this phone number already exists");
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email,
      password: hashedPassword,
      role: data.role,
    },
  });

  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

export async function loginService(data: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { phone: data.phone },
  });

  if (!user) {
    throw new Error("Invalid phone number or password");
  }

  if (!user.isActive) {
    const err: any = new Error(
      "Your account has been deactivated. Please contact your admin.",
    );
    err.statusCode = 403;
    throw err;
  }

  const isPasswordValid = await bcrypt.compare(data.password, user.password);

  if (!isPasswordValid) {
    throw new Error("Invalid phone number or password");
  }

  const accessToken = generateAccessToken(user.id, user.role);

  const rawRefreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawRefreshToken),
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  const { password, ...userWithoutPassword } = user;
  return {
    user: userWithoutPassword,
    accessToken,
    refreshToken: rawRefreshToken,
  };
}

export async function refreshAccessTokenService(rawRefreshToken: string) {
  const tokenHash = hashToken(rawRefreshToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (
    !stored ||
    stored.revoked ||
    stored.expiresAt < new Date() ||
    !stored.user
  ) {
    throw new Error("Invalid or expired refresh token");
  }

  if (!stored.user.isActive) {
    const err: any = new Error("Your account has been deactivated.");
    err.statusCode = 403;
    throw err;
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revoked: true },
  });

  const newRawRefreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: stored.user.id,
      tokenHash: hashToken(newRawRefreshToken),
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  const accessToken = generateAccessToken(stored.user.id, stored.user.role);

  return { accessToken, refreshToken: newRawRefreshToken };
}

export async function logoutService(rawRefreshToken: string) {
  const tokenHash = hashToken(rawRefreshToken);

  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { revoked: true },
  });

  return { message: "Logged out successfully" };
}
