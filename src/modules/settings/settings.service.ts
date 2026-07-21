import prisma from "../../config/db";

interface UpsertSettingsInput {
  businessName: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  address?: string;
  state?: string;
  currency?: string;
  taxPercent?: number;
}

export async function getStoreSettingsService() {
  const settings = await prisma.storeSettings.findFirst();

  if (!settings) {
    throw new Error("Store settings have not been configured yet");
  }

  return settings;
}

export async function upsertStoreSettingsService(data: UpsertSettingsInput) {
  const existing = await prisma.storeSettings.findFirst();

  if (existing) {
    return prisma.storeSettings.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.storeSettings.create({ data });
}