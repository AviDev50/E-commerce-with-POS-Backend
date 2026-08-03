import prisma from "../../config/db.js";
import { formatImageUrl } from "../../utils/formatImageUrl.js"; // ⚠️ apna actual utility path daalo

export async function getActiveBannersService() {
  const banners = await prisma.banner.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      linkUrl: true,
      sortOrder: true,
    },
  });

  return banners.map((b) => ({
    ...b,
    imageUrl: formatImageUrl(b.imageUrl),
  }));
}