import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../../config/db.js";
import {
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiry,
} from "../../utils/refreshToken.js";
import { sendOtpViaIndopay } from "../../utils/indopay.js";

interface RegisterInput {
  name: string;
  phone: string;
  email?: string;
  password: string;
}

interface LoginInput {
  phone: string;
  password: string;
}

function httpError(message: string, statusCode: number, errorCode?: string) {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  if (errorCode) err.errorCode = errorCode;
  return err;
}

function generateAccessToken(id: string): string {
  return jwt.sign({ id, type: "customer" }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.ACCESS_TOKEN_EXPIRES_IN ||
      "15m") as jwt.SignOptions["expiresIn"],
  });
}

async function issueCustomerSession(customer: {
  id: string;
  password: string | null;
  [k: string]: any;
}) {
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
  return {
    customer: customerWithoutPassword,
    accessToken,
    refreshToken: rawRefreshToken,
  };
}

export async function registerCustomerService(data: RegisterInput) {
  const existing = await prisma.customer.findUnique({
    where: { phone: data.phone },
  });
  if (existing) {
    throw httpError("Customer with this phone number already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const customer = await prisma.customer.create({
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email,
      password: hashedPassword,
    },
  });

  const { password: _password, ...customerWithoutPassword } = customer;
  return customerWithoutPassword;
}

export async function loginCustomerService(data: LoginInput) {
  const customer = await prisma.customer.findUnique({
    where: { phone: data.phone },
  });
  if (!customer) {
    throw new Error("Invalid phone number or password");
  }

  if (!customer.isActive) {
    throw httpError("Your account has been deactivated.", 403);
  }

  if (!customer.password) {
    throw new Error(
      "This account has no password set. Please login with OTP.",
    );
  }

  const isPasswordValid = await bcrypt.compare(
    data.password,
    customer.password,
  );
  if (!isPasswordValid) {
    throw new Error("Invalid phone number or password");
  }

  return issueCustomerSession(customer);
}

export async function refreshCustomerAccessTokenService(
  rawRefreshToken: string,
) {
  const tokenHash = hashToken(rawRefreshToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { customer: true },
  });

  if (
    !stored ||
    stored.revoked ||
    stored.expiresAt < new Date() ||
    !stored.customer
  ) {
    throw new Error("Invalid or expired refresh token");
  }

  if (!stored.customer.isActive) {
    throw httpError("Your account has been deactivated.", 403);
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revoked: true },
  });

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

/* ───────────────────────── OTP LOGIN / SIGNUP ───────────────────────── */

const OTP_DIGITS = (Number(process.env.OTP_DIGITS) === 4 ? 4 : 6) as 4 | 6;
const OTP_TTL_MS = Number(process.env.OTP_TTL_MINUTES || 2) * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const RESEND_COOLDOWN_SEC = RESEND_COOLDOWN_MS / 1000;
const HOUR_MS = 3_600_000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;

function hashOtp(phone: string, otp: string) {
  return crypto
    .createHmac("sha256", process.env.OTP_HASH_SECRET as string)
    .update(`${phone}:${otp}`)
    .digest("hex");
}

export async function requestCustomerOtpService(phone: string) {
  // Deactivated customer ko OTP nahi (credits bachte hain)
  const customer = await prisma.customer.findUnique({ where: { phone } });
  if (customer && !customer.isActive) {
    return { message: "Unable to send OTP to this number.", sent: false };
  }

  const now = Date.now();

  // 60s cooldown
  const last = await prisma.otpCode.findFirst({
    where: { phone },
    orderBy: { createdAt: "desc" },
  });
  if (last) {
    const elapsed = now - last.createdAt.getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      return {
        message: "Please wait before requesting another OTP.",
        sent: false,
        retryAfter: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000),
      };
    }
  }

  // Hourly cap
  const windowStart = new Date(now - HOUR_MS);
  const sentLastHour = await prisma.otpCode.count({
    where: { phone, createdAt: { gt: windowStart } },
  });
  if (sentLastHour >= MAX_SENDS_PER_HOUR) {
    const oldest = await prisma.otpCode.findFirst({
      where: { phone, createdAt: { gt: windowStart } },
      orderBy: { createdAt: "asc" },
    });
    const retryAfter = oldest
      ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + HOUR_MS - now) / 1000))
      : undefined;
    return {
      message: "Too many OTP requests. Try again later.",
      sent: false,
      retryAfter,
    };
  }

  const otp = await sendOtpViaIndopay(phone, OTP_DIGITS);

  await prisma.$transaction([
    prisma.otpCode.updateMany({
      where: { phone, consumed: false },
      data: { consumed: true },
    }),
    prisma.otpCode.create({
      data: {
        phone,
        codeHash: hashOtp(phone, otp),
        expiresAt: new Date(now + OTP_TTL_MS),
      },
    }),
  ]);

  return { message: "OTP sent.", sent: true, retryAfter: RESEND_COOLDOWN_SEC };
}

export async function verifyCustomerOtpService(
  phone: string,
  otp: string,
  name?: string,
) {
  const invalid = () => httpError("Invalid or expired OTP", 401, "INVALID_OTP");

  const record = await prisma.otpCode.findFirst({
    where: { phone, consumed: false },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.expiresAt < new Date()) throw invalid();

  // Pehle attempt increment, phir compare
  const updated = await prisma.otpCode.update({
    where: { id: record.id },
    data: { attempts: { increment: 1 } },
  });
  if (updated.attempts > MAX_VERIFY_ATTEMPTS) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { consumed: true },
    });
    throw invalid();
  }

  const a = Buffer.from(hashOtp(phone, otp));
  const b = Buffer.from(record.codeHash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw invalid();

  let customer = await prisma.customer.findUnique({ where: { phone } });

  if (customer && !customer.isActive) {
    throw httpError("Your account has been deactivated.", 403, "ACCOUNT_DEACTIVATED");
  }
  if (!customer && !name) {
    // OTP consume nahi hota, wahi OTP name ke saath dobara chalega
    throw httpError("name is required to create a new account", 400, "NAME_REQUIRED");
  }

  // Atomic consume
  const { count } = await prisma.otpCode.updateMany({
    where: { id: record.id, consumed: false },
    data: { consumed: true },
  });
  if (count === 0) throw invalid();

  if (!customer) {
    try {
      customer = await prisma.customer.create({
        data: { name: name as string, phone },
      });
    } catch (e: any) {
      if (e.code === "P2002") {
        customer = await prisma.customer.findUnique({ where: { phone } });
      } else {
        throw e;
      }
    }
    if (!customer) throw httpError("Could not create account", 500);
  }

  return issueCustomerSession(customer);
}
