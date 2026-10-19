import prisma from "../../config/db.js";
import { formatImageUrl } from "../../utils/formatImageUrl.js";

interface CreateBannerInput {
  title?: string;
  imageUrl: string;
  linkUrl?: string;
  sortOrder?: number;
}

interface UpdateBannerInput {
  title?: string;
  imageUrl?: string;
  linkUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}

function formatBanner(banner: any) {
  return {
    ...banner,
    imageUrl: formatImageUrl(banner.imageUrl),
  };
}

export async function createBannerService(input: CreateBannerInput) {
  const banner = await prisma.banner.create({
    data: {
      title: input.title,
      imageUrl: input.imageUrl,
      linkUrl: input.linkUrl,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  return formatBanner(banner);
}

export async function getAllBannersService() {
  // Admin ko SAB banners dikhenge — active aur inactive dono, management ke liye
  const banners = await prisma.banner.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return banners.map(formatBanner);
}

export async function getBannerByIdService(id: string) {
  const banner = await prisma.banner.findUnique({ where: { id } });
  if (!banner) {
    throw new Error("Banner not found");
  }
  return formatBanner(banner);
}

export async function updateBannerService(
  id: string,
  input: UpdateBannerInput,
) {
  const existing = await prisma.banner.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Banner not found");
  }

  const banner = await prisma.banner.update({
    where: { id },
    data: {
      title: input.title,
      imageUrl: input.imageUrl,
      linkUrl: input.linkUrl,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    },
  });
  return formatBanner(banner);
}

export async function deleteBannerService(id: string) {
  const existing = await prisma.banner.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Banner not found");
  }
  await prisma.banner.delete({ where: { id } });
}
