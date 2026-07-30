import prisma from "../../config/db.js";
import { formatImageUrl } from "../../utils/formatImageUrl.js";

interface AddToCartInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

async function getOrCreateCart(customerId: string) {
  let cart = await prisma.cart.findUnique({ where: { customerId } });
  if (!cart) {
    cart = await prisma.cart.create({ data: { customerId } });
  }
  return cart;
}

function parseImages(images: any): string[] {
  if (Array.isArray(images)) return images;
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function buildCartResponse(cartId: string) {
  const items = await prisma.cartItem.findMany({
    where: { cartId },
    include: {
      product: {
        select: { id: true, name: true, slug: true, images: true, price: true, isActive: true, stock: true },
      },
      variant: {
        select: { id: true, sku: true, price: true, stock: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  let subtotal = 0;

const mappedItems = items.map((item) => {
  const unitPrice = item.variant ? Number(item.variant.price) : Number(item.product.price);
  const availableStock = item.variant ? item.variant.stock : item.product.stock;
  const lineTotal = unitPrice * item.quantity;
  subtotal += lineTotal;

  const rawImage = parseImages(item.product.images)[0];
  const image = rawImage ? formatImageUrl(rawImage) : null;

  return {
    id: item.id,
    productId: item.product.id,
    productName: item.product.name,
    productSlug: item.product.slug,
    image,
    variantId: item.variant?.id || null,
    variantSku: item.variant?.sku || null,
    quantity: item.quantity,
    unitPrice,
    lineTotal,
    availableStock,
    isActive: item.product.isActive,
    inStockEnough: availableStock >= item.quantity,
  };
});

  return {
    cartId,
    items: mappedItems,
    subtotal,
    itemCount: mappedItems.reduce((sum, i) => sum + i.quantity, 0),
  };
}

export async function getCartService(customerId: string) {
  const cart = await getOrCreateCart(customerId);
  return buildCartResponse(cart.id);
}

export async function addToCartService(customerId: string, input: AddToCartInput) {
  const { productId, variantId, quantity } = input;

  if (!productId || !quantity || quantity < 1) {
    throw new Error("productId and a valid quantity are required");
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.isActive) {
    throw new Error("Product not found or inactive");
  }

  let availableStock = product.stock;

  if (variantId) {
    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || variant.productId !== productId) {
      throw new Error("Variant not found for this product");
    }
    availableStock = variant.stock;
  }

  const cart = await getOrCreateCart(customerId);

  const existingItem = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, productId, variantId: variantId || null },
  });

  const desiredQuantity = existingItem ? existingItem.quantity + quantity : quantity;

  if (desiredQuantity > availableStock) {
    throw new Error(`Only ${availableStock} unit(s) available in stock`);
  }

  if (existingItem) {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: desiredQuantity },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        variantId: variantId || null,
        quantity,
      },
    });
  }

  return buildCartResponse(cart.id);
}

export async function updateCartItemService(customerId: string, itemId: string, quantity: number) {
  if (!quantity || quantity < 1) {
    throw new Error("A valid quantity is required");
  }

  const cart = await prisma.cart.findUnique({ where: { customerId } });
  if (!cart) throw new Error("Cart not found");

  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: { product: true, variant: true },
  });

  if (!item || item.cartId !== cart.id) {
    throw new Error("Cart item not found");
  }

  const availableStock = item.variant ? item.variant.stock : item.product.stock;
  if (quantity > availableStock) {
    throw new Error(`Only ${availableStock} unit(s) available in stock`);
  }

  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });

  return buildCartResponse(cart.id);
}

export async function removeCartItemService(customerId: string, itemId: string) {
  const cart = await prisma.cart.findUnique({ where: { customerId } });
  if (!cart) throw new Error("Cart not found");

  const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
  if (!item || item.cartId !== cart.id) {
    throw new Error("Cart item not found");
  }

  await prisma.cartItem.delete({ where: { id: itemId } });

  return buildCartResponse(cart.id);
}

export async function clearCartService(customerId: string) {
  const cart = await prisma.cart.findUnique({ where: { customerId } });
  if (!cart) throw new Error("Cart not found");

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  return buildCartResponse(cart.id);
}