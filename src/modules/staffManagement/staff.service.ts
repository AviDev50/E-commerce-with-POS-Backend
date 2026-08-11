import prisma from "../../config/db.js";
import { Role } from "@prisma/client";

const staffSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
};

interface ListStaffFilter {
  role?: string;
  isActive?: boolean;
}

export async function listStaffService(filter: ListStaffFilter) {
  return prisma.user.findMany({
    where: {
      role: filter.role ? (filter.role as Role) : undefined,
      isActive: filter.isActive,
    },
    select: staffSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function getStaffByIdService(id: string) {
  const staff = await prisma.user.findUnique({ where: { id }, select: staffSelect });
  if (!staff) {
    const err: any = new Error("Staff not found");
    err.statusCode = 404;
    throw err;
  }
  return staff;
}

export async function deactivateStaffService(id: string, requestedById: string) {
  if (id === requestedById) {
    const err: any = new Error("You cannot deactivate your own account");
    err.statusCode = 400;
    throw err;
  }

  const staff = await prisma.user.findUnique({ where: { id } });
  if (!staff) {
    const err: any = new Error("Staff not found");
    err.statusCode = 404;
    throw err;
  }

  if (staff.role === "ADMIN") {
    const activeAdminCount = await prisma.user.count({
      where: { role: "ADMIN", isActive: true },
    });
    if (activeAdminCount <= 1) {
      const err: any = new Error("Cannot deactivate the last active admin");
      err.statusCode = 400;
      throw err;
    }
  }

  return prisma.user.update({
    where: { id },
    data: { isActive: false },
    select: staffSelect,
  });
}

export async function activateStaffService(id: string) {
  const staff = await prisma.user.findUnique({ where: { id } });
  if (!staff) {
    const err: any = new Error("Staff not found");
    err.statusCode = 404;
    throw err;
  }

  return prisma.user.update({
    where: { id },
    data: { isActive: true },
    select: staffSelect,
  });
}

export async function changeStaffRoleService(id: string, role: string, requestedById: string) {
  if (id === requestedById) {
    const err: any = new Error("You cannot change your own role");
    err.statusCode = 400;
    throw err;
  }

  if (!["ADMIN", "MANAGER", "CASHIER"].includes(role)) {
    const err: any = new Error("Invalid role value");
    err.statusCode = 400;
    throw err;
  }

  const staff = await prisma.user.findUnique({ where: { id } });
  if (!staff) {
    const err: any = new Error("Staff not found");
    err.statusCode = 404;
    throw err;
  }

  if (staff.role === "ADMIN" && role !== "ADMIN") {
    const activeAdminCount = await prisma.user.count({
      where: { role: "ADMIN", isActive: true },
    });
    if (activeAdminCount <= 1) {
      const err: any = new Error("Cannot change role of the last active admin");
      err.statusCode = 400;
      throw err;
    }
  }

  return prisma.user.update({
    where: { id },
    data: { role: role as Role },
    select: staffSelect,
  });
}