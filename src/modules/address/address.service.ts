import prisma from "../../config/db.js";
import { AddressType } from "@prisma/client";

interface CreateAddressInput {
  customerId: string;
  type?: AddressType;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
}

interface UpdateAddressInput {
  type?: AddressType;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
}

export async function createAddressService(data: CreateAddressInput) {
  if (data.isDefault) {
    await prisma.address.updateMany({
      where: { customerId: data.customerId },
      data: { isDefault: false },
    });
  }

  return prisma.address.create({
    data: {
      customerId: data.customerId,
      type: data.type,
      line1: data.line1,
      line2: data.line2,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      country: data.country,
      isDefault: data.isDefault ?? false,
    },
  });
}

export async function getAddressesByCustomerService(customerId: string) {
  return prisma.address.findMany({
    where: { customerId },
    orderBy: { isDefault: "desc" },
  });
}

export async function getAddressByIdService(id: string, customerId: string) {
  const address = await prisma.address.findUnique({ where: { id } });

  if (!address || address.customerId !== customerId) {
    throw new Error("Address not found");
  }

  return address;
}

export async function updateAddressService(id: string, customerId: string, data: UpdateAddressInput) {
  const existing = await prisma.address.findUnique({ where: { id } });

  if (!existing || existing.customerId !== customerId) {
    throw new Error("Address not found");
  }

  if (data.isDefault) {
    await prisma.address.updateMany({
      where: { customerId, NOT: { id } },
      data: { isDefault: false },
    });
  }

  return prisma.address.update({ where: { id }, data });
}

export async function deleteAddressService(id: string, customerId: string) {
  const existing = await prisma.address.findUnique({ where: { id } });

  if (!existing || existing.customerId !== customerId) {
    throw new Error("Address not found");
  }

  return prisma.address.delete({ where: { id } });
}