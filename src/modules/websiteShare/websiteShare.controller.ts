import { Request, Response } from "express";
import * as shareService from "./websiteShare.service.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// JSON — React + Flutter share button yahi use karenge
export async function getProductShareData(req: Request, res: Response) {
  try {
    const slug = req.params.slug as string;
    const data = await shareService.getProductShareDataService(slug);
    return res.status(200).json({ data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

// HTML — crawlers ke liye OG tags, browser ke liye redirect
export async function renderProductSharePage(req: Request, res: Response) {
  const slug = req.params.slug as string;

  try {
    const p = await shareService.getProductShareDataService(slug);

    const title = escapeHtml(p.storeName ? `${p.name} | ${p.storeName}` : p.name);
    const priceLine =
      p.discountPercent > 0
        ? `${p.priceText} (${p.discountPercent}% off)`
        : p.priceText;
    const desc = escapeHtml(p.description ? `${priceLine} — ${p.description}` : priceLine);
    const shareUrl = escapeHtml(p.shareUrl);
    const webUrl = escapeHtml(p.webUrl);
    const jsUrl = JSON.stringify(p.webUrl).replace(/</g, "\\u003c");

    const imageTags = p.image
      ? `<meta property="og:image" content="${escapeHtml(p.image)}" />
<meta name="twitter:image" content="${escapeHtml(p.image)}" />`
      : "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${shareUrl}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${escapeHtml(p.storeName)}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:url" content="${shareUrl}" />
${imageTags}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${desc}" />
<noscript><meta http-equiv="refresh" content="0;url=${webUrl}" /></noscript>
<script>window.location.replace(${jsUrl});</script>
</head>
<body>
<p>Redirecting… <a href="${webUrl}">Open product</a></p>
</body>
</html>`;

    return res
      .status(200)
      .set("Content-Type", "text/html; charset=utf-8")
      .set("Cache-Control", "public, max-age=300")
      .send(html);
  } catch (error: any) {
    const status = error.statusCode || 500;
    const home = escapeHtml((process.env.FRONTEND_URL ?? "").replace(/\/+$/, "") || "/");
    return res
      .status(status)
      .set("Content-Type", "text/html; charset=utf-8")
      .send(
        `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Product not available</title></head>` +
          `<body><p>This product is not available.</p><a href="${home}">Go to store</a></body></html>`,
      );
  }
}