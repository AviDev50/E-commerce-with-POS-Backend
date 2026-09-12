import prisma from "../../config/db.js";
import { PageType } from "@prisma/client";
import { sanitizePageContent } from "../../utils/sanitizeHtml.js";

export async function getAllPagesService() {
  return prisma.storePage.findMany({ orderBy: { type: "asc" } });
}

export async function getPageByTypeService(type: PageType) {
  const page = await prisma.storePage.findUnique({ where: { type } });
  if (!page) {
    throw new Error("Page not found — content not set yet for this page type");
  }
  return page;
}

export async function upsertPageService(
  type: PageType,
  title: string,
  content: string,
) {
  if (!title?.trim() || !content?.trim()) {
    throw new Error("title and content are required");
  }

  const cleanContent = sanitizePageContent(content);

  const page = await prisma.storePage.upsert({
    where: { type },
    update: { title: title.trim(), content: cleanContent },
    create: { type, title: title.trim(), content: cleanContent },
  });

  return page;
}
