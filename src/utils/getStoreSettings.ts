import prisma from "../config/db.js";

export async function getStoreSettings() {
  return prisma.storeSettings.findFirst();
}