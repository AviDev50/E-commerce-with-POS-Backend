import prisma from "../config/db";

export async function getStoreSettings() {
  return prisma.storeSettings.findFirst();
}