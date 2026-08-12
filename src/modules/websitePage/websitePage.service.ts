import prisma from "../../config/db.js";
import { PageType } from "@prisma/client";

export async function getAllWebsitePagesService() {
  // Content nahi bhejenge listing mein — sirf footer links ke liye halka payload (title + type)
  return prisma.storePage.findMany({
    select: { type: true, title: true, updatedAt: true },
    orderBy: { type: "asc" },
  });
}

export async function getWebsitePageByTypeService(type: PageType) {
  const page = await prisma.storePage.findUnique({ where: { type } });
  if (!page) {
    throw new Error("Page not found");
  }
  return page;
}