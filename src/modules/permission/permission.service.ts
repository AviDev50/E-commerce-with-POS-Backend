import prisma from "../../config/db";
import { Role } from "@prisma/client";

export async function getAllPermissionsService() {
  return prisma.permission.findMany({
    orderBy: { key: "asc" },
  });
}

export async function getPermissionsByRoleService(role: Role) {
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { role },
    include: { permission: true },
  });

  return rolePermissions.map((rp) => rp.permission);
}

export async function assignPermissionService(role: Role, permissionKey: string) {
  const permission = await prisma.permission.findUnique({ where: { key: permissionKey } });

  if (!permission) {
    throw new Error("Permission not found");
  }

  const existing = await prisma.rolePermission.findUnique({
    where: { role_permissionId: { role, permissionId: permission.id } },
  });

  if (existing) {
    throw new Error(`${role} already has this permission`);
  }

  return prisma.rolePermission.create({
    data: { role, permissionId: permission.id },
  });
}

export async function revokePermissionService(role: Role, permissionKey: string) {
  const permission = await prisma.permission.findUnique({ where: { key: permissionKey } });

  if (!permission) {
    throw new Error("Permission not found");
  }

  const existing = await prisma.rolePermission.findUnique({
    where: { role_permissionId: { role, permissionId: permission.id } },
  });

  if (!existing) {
    throw new Error(`${role} does not have this permission`);
  }

  await prisma.rolePermission.delete({
    where: { id: existing.id },
  });

  return { role, permissionKey, revoked: true };
}