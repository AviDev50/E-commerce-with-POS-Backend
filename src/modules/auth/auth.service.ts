import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../../config/db";
import { Role } from "@prisma/client";

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
export const registerService = async (data: RegisterInput) => {
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
};

export const loginService = async (data: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { phone: data.phone },
  });

  if (!user) {
    throw new Error("Invalid phone number or password");
  }

  const isPasswordValid = await bcrypt.compare(data.password, user.password);

  if (!isPasswordValid) {
    throw new Error("Invalid phone number or password");
  }

const token = jwt.sign(
  { id: user.id, role: user.role },
  process.env.JWT_SECRET as string,
  { expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"] }
);

  const { password, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
};