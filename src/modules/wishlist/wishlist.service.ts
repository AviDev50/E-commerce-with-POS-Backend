import prisma from "../../config/db.js"; // apne actual prisma client ka path check kar lena

// ==================== TOGGLE WISHLIST ====================
export async function toggleWishlist(
  customerId: string,
  productId: string,
  variantId?: string
) {
  const existing = await prisma.wishlistItem.findFirst({
    where: { customerId, productId, variantId: variantId ?? null },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    return { wishlisted: false };
  }

  await prisma.wishlistItem.create({
    data: { customerId, productId, variantId: variantId ?? null },
  });
  return { wishlisted: true };
}

// ==================== GET WISHLIST ====================
export async function getWishlist(customerId: string) {
  const items = await prisma.wishlistItem.findMany({
    where: { customerId },
    include: {
      product: true,
      variant: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return items.map((item) => {
    const stock = item.variantId ? item.variant?.stock ?? 0 : item.product.stock;
    const price = item.variantId ? item.variant?.price ?? item.product.price : item.product.price;
    const isAvailable = item.product.isActive && stock > 0;

    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      name: item.product.name,
      variantName: item.variant?.name ?? null,
      slug: item.product.slug,
      displayPrice: price,
      stock,
      isAvailable,
      createdAt: item.createdAt,
    };
  });
}

// ==================== MOVE TO CART ====================
export async function moveToCart(customerId: string, wishlistItemId: string) {
  const wishlistItem = await prisma.wishlistItem.findFirst({
    where: { id: wishlistItemId, customerId },
    include: { product: true, variant: true },
  });

  if (!wishlistItem) {
    throw new Error("Wishlist item not found");
  }

  const stock = wishlistItem.variantId
    ? wishlistItem.variant?.stock ?? 0
    : wishlistItem.product.stock;

  if (!wishlistItem.product.isActive || stock <= 0) {
    throw new Error("Product out of stock");
  }

  return prisma.$transaction(async (tx) => {
    // Cart ek customer ka ek hi hota hai (customerId @unique) — find or create
    let cart = await tx.cart.findUnique({ where: { customerId } });
    if (!cart) {
      cart = await tx.cart.create({ data: { customerId } });
    }

    const existingCartItem = await tx.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: wishlistItem.productId,
        variantId: wishlistItem.variantId,
      },
    });

    if (existingCartItem) {
      await tx.cartItem.update({
        where: { id: existingCartItem.id },
        data: { quantity: { increment: 1 } },
      });
    } else {
      await tx.cartItem.create({
        data: {
          cartId: cart.id,
          productId: wishlistItem.productId,
          variantId: wishlistItem.variantId,
          quantity: 1,
        },
      });
    }

    await tx.wishlistItem.delete({ where: { id: wishlistItemId } });

    return { moved: true };
  });
}