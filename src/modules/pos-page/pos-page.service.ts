import prisma from "../../config/db.js";
import { PosPageType } from "@prisma/client";
import { sanitizePageContent } from "../../utils/sanitizeHtml.js";

export async function getAllPosPagesService() {
  return prisma.posPage.findMany({
    select: { type: true, title: true, updatedAt: true },
    orderBy: { type: "asc" },
  });
}

export async function getPosPageByTypeService(type: PosPageType) {
  return prisma.posPage.findUnique({ where: { type } });
}

export async function upsertPosPageService(
  type: PosPageType,
  title: string,
  content: string,
) {
  if (!title?.trim() || !content?.trim()) {
    throw new Error("title and content are required");
  }

  const cleanContent = sanitizePageContent(content);

  return prisma.posPage.upsert({
    where: { type },
    update: { title: title.trim(), content: cleanContent },
    create: { type, title: title.trim(), content: cleanContent },
  });
}