import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../../config/db.js";
import { generateRefreshToken, hashToken, getRefreshTokenExpiry } from "../../utils/refreshToken.js";
import {Gender} from "@prisma/client"

interface RegisterInput {
  name: string;
  phone: string;
  email?: string;
  password: string;
  dob: string;
  gender: Gender;
}

interface LoginInput {
  phone: string;
  password: string;
}

function generateAccessToken(id: string): string {
  return jwt.sign(
    { id, type: "customer" },
    process.env.JWT_SECRET as string,
    { expiresIn: (process.env.ACCESS_TOKEN_EXPIRES_IN || "15m") as jwt.SignOptions["expiresIn"] }
  );
}

export async function registerCustomerService(data: RegisterInput) {
  const existing = await prisma.customer.findUnique({ where: { phone: data.phone } });
  if (existing) {
    const err: any = new Error("Customer with this phone number already exists");
    err.statusCode = 409;
    throw err;
  }

  if (!["MALE", "FEMALE", "OTHER"].includes(data.gender)) {
    const err: any = new Error("Invalid gender value");
    err.statusCode = 400;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const customer = await prisma.customer.create({
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email,
      password: hashedPassword,
      dob: new Date(data.dob),
      gender: data.gender,
    },
  });

  const { password: _password, ...customerWithoutPassword } = customer;
  return customerWithoutPassword;
}

export async function loginCustomerService(data: LoginInput) {
  const customer = await prisma.customer.findUnique({ where: { phone: data.phone } });
  if (!customer) {
    throw new Error("Invalid phone number or password");
  }

    if (!customer.password) {
    throw new Error("This account has no password set. Please complete registration first.");
  }

  const isPasswordValid = await bcrypt.compare(data.password, customer.password);
  if (!isPasswordValid) {
    throw new Error("Invalid phone number or password");
  }

  const accessToken = generateAccessToken(customer.id);

  const rawRefreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      customerId: customer.id,
      tokenHash: hashToken(rawRefreshToken),
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  const { password, ...customerWithoutPassword } = customer;
  return { customer: customerWithoutPassword, accessToken, refreshToken: rawRefreshToken };
}

export async function refreshCustomerAccessTokenService(rawRefreshToken: string) {
  const tokenHash = hashToken(rawRefreshToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { customer: true },
  });

  if (!stored || stored.revoked || stored.expiresAt < new Date() || !stored.customer) {
    throw new Error("Invalid or expired refresh token");
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

  const newRawRefreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      customerId: stored.customer.id,
      tokenHash: hashToken(newRawRefreshToken),
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  const accessToken = generateAccessToken(stored.customer.id);

  return { accessToken, refreshToken: newRawRefreshToken };
}

export async function logoutCustomerService(rawRefreshToken: string) {
  const tokenHash = hashToken(rawRefreshToken);

  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { revoked: true },
  });

  return { message: "Logged out successfully" };
}