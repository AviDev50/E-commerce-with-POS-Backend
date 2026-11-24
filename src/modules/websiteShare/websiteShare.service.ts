import prisma from "../../config/db.js";
import { formatImageUrl } from "../../utils/formatImageUrl.js";
import {
  SELLABLE,
  parseImages,
  resolvePricing,
} from "../websiteProduct/websiteProduct.service.js";

const trimSlash = (s: string) => s.replace(/\/+$/, "");

export function buildShareUrls(slug: string) {
  const s = encodeURIComponent(slug);
  return {
    // backend ka public link — OG tags yahin se milte hain
    shareUrl: `${trimSlash(process.env.BASE_URL ?? "")}/share/product/${s}`,
    // React site ka asli product page
    webUrl: `${trimSlash(process.env.FRONTEND_URL ?? "")}/product/${s}`,
  };
}

export async function getProductShareDataService(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true, AND: [SELLABLE] },
    select: {
      name: true,
      slug: true,
      description: true,
      images: true,
      price: true,
      mrp: true,
      variants: { where: { isActive: true }, select: { price: true, mrp: true } },
    },
  });

  if (!product) {
    const err: any = new Error("Product not found");
    err.statusCode = 404;
    throw err;
  }

  const hasVariants = product.variants.length > 0;
  const { displayPrice, mrp, discountPercent } = resolvePricing(
    Number(product.price),
    product.mrp,
    product.variants,
  );

  const store = await prisma.storeSettings.findFirst({
    select: { businessName: true, currency: true },
  });
  const currency = store?.currency ?? "INR";

  let formatted = String(displayPrice);
  try {
    formatted = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(displayPrice);
  } catch {
    // invalid currency code — plain number chalega
  }

  const imgs = parseImages(product.images);
  const description = (product.description ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  return {
    name: product.name,
    slug: product.slug,
    description,
    image: imgs.length > 0 ? formatImageUrl(imgs[0]) : null,
    displayPrice,
    mrp,
    discountPercent,
    currency,
    priceText: hasVariants ? `From ${formatted}` : formatted,
    storeName: store?.businessName ?? "",
    ...buildShareUrls(product.slug),
  };
}