import { formatImageUrls } from "./formatImageUrl.js";

// Product-service ke `withFullImageUrls` jaisa hi generic helper —
// yahan bhi reuse kar rahe hain taaki DRY rahe, sirf import path badla hai
export function withFullImageUrls<T extends { images: string | null }>(item: T) {
  const imagesArray: string[] = item.images ? JSON.parse(item.images) : [];
  return { ...item, images: formatImageUrls(imagesArray) };
}

// ReturnRequest ke response mein nested orderItem.product, orderItem.variant,
// aur exchangeVariant — teeno ke images alag-alag JSON string hote hain,
// isliye ek composed formatter jo admin aur website dono service mein reuse ho
export function formatReturnResponse(r: any) {
  return {
    ...withFullImageUrls(r),
    orderItem: r.orderItem && {
      ...r.orderItem,
      product: r.orderItem.product ? withFullImageUrls(r.orderItem.product) : r.orderItem.product,
      variant: r.orderItem.variant ? withFullImageUrls(r.orderItem.variant) : r.orderItem.variant,
    },
    exchangeVariant: r.exchangeVariant ? withFullImageUrls(r.exchangeVariant) : r.exchangeVariant,
  };
}