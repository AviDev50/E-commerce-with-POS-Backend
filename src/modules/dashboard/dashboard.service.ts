import prisma from "../../config/db.js";
import { Prisma, OrderStatus } from "@prisma/client";
import { formatImageUrl } from "../../utils/formatImageUrl.js";

interface DashboardSummaryQuery {
  from?: string;
  to?: string;
}

interface LowStockProductRow {
  id: string;
  name: string;
  sku: string;
  stock: number;
  lowStockThreshold: number;
  images: string | null;
}

interface LowStockVariantRow {
  variantId: string;
  variantName: string;
  sku: string;
  stock: number;
  productId: string;
  productName: string;
  lowStockThreshold: number;
  images: string | null;
}

function getThumbnailUrl(images: string | null): string | null {
  if (!images) return null;
  try {
    const imagesArray: string[] = JSON.parse(images);
    return Array.isArray(imagesArray) && imagesArray.length
      ? formatImageUrl(imagesArray[0])
      : null;
  } catch {
    return null; // corrupted data — crash karne ki jagah null image dikhao
  }
}

function resolveDateRange(from?: string, to?: string) {
  const toDate = to ? new Date(to) : new Date();
  toDate.setHours(23, 59, 59, 999);

  const fromDate = from ? new Date(from) : new Date(toDate);
  if (!from) fromDate.setDate(fromDate.getDate() - 30);
  fromDate.setHours(0, 0, 0, 0);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    const err: any = new Error("Invalid from/to date format");
    err.statusCode = 400;
    throw err;
  }
  if (fromDate > toDate) {
    const err: any = new Error("'from' date cannot be after 'to' date");
    err.statusCode = 400;
    throw err;
  }

  return { fromDate, toDate };
}

export async function getDashboardSummary(query: DashboardSummaryQuery) {
  const { fromDate, toDate } = resolveDateRange(query.from, query.to);
  const dateFilter = { createdAt: { gte: fromDate, lte: toDate } };

  const [
    completedAgg,
    totalOrdersCount,
    statusGroups,
    channelGroups,
    lowStockProducts,
    lowStockVariants,
    completedOrderIds,
    recentOrders,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { status: OrderStatus.COMPLETED, ...dateFilter },
      _sum: { total: true },
      _count: { _all: true },
    }),

    prisma.order.count({ where: dateFilter }),

    prisma.order.groupBy({
      by: ["status"],
      where: dateFilter,
      _count: { _all: true },
      _sum: { total: true },
    }),

    prisma.order.groupBy({
      by: ["channel"],
      where: { status: OrderStatus.COMPLETED, ...dateFilter },
      _count: { _all: true },
      _sum: { total: true },
    }),

    prisma.$queryRaw<LowStockProductRow[]>(Prisma.sql`
      SELECT id, name, sku, stock, lowStockThreshold, images
      FROM products
      WHERE isActive = true AND stock <= lowStockThreshold
      ORDER BY stock ASC
      LIMIT 20
    `),

    prisma.$queryRaw<LowStockVariantRow[]>(Prisma.sql`
      SELECT pv.id as variantId, pv.name as variantName, pv.sku, pv.stock,
             p.id as productId, p.name as productName, p.lowStockThreshold, pv.images
      FROM product_variants pv
      JOIN products p ON pv.productId = p.id
      WHERE p.isActive = true AND pv.stock <= p.lowStockThreshold
      ORDER BY pv.stock ASC
      LIMIT 20
    `),

    prisma.order.findMany({
      where: { status: OrderStatus.COMPLETED, ...dateFilter },
      select: { id: true },
    }),

    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { customer: { select: { name: true } } },
    }),
  ]);

  // ---- Top selling products (from completed orders in range) ----
  const orderIds = completedOrderIds.map((o) => o.id);
  const topItems = orderIds.length
    ? await prisma.orderItem.groupBy({
        by: ["productId"],
        where: { orderId: { in: orderIds } },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      })
    : [];

  const topProductDetails = topItems.length
    ? await prisma.product.findMany({
        where: { id: { in: topItems.map((t) => t.productId) } },
        select: { id: true, name: true, sku: true, images: true },
      })
    : [];

  const topSellingProducts = topItems.map((t) => {
    const product = topProductDetails.find((p) => p.id === t.productId);
    return {
      productId: t.productId,
      name: product?.name ?? "Unknown",
      sku: product?.sku ?? null,
      image: getThumbnailUrl(product?.images ?? null),
      quantitySold: t._sum.quantity ?? 0,
      revenue: Number(t._sum.subtotal ?? 0),
    };
  });

  // ---- Sales overview ----
  const totalRevenue = Number(completedAgg._sum.total ?? 0);
  const completedOrdersCount = completedAgg._count._all;
  const averageOrderValue =
    completedOrdersCount > 0 ? totalRevenue / completedOrdersCount : 0;

  // ---- Low stock merge (simple products + variants) ----
  const lowStockAlerts = [
    ...lowStockProducts.map((p) => ({
      productId: p.id,
      variantId: null,
      name: p.name,
      sku: p.sku,
      stock: p.stock,
      lowStockThreshold: p.lowStockThreshold,
      image: getThumbnailUrl(p.images),
    })),
    ...lowStockVariants.map((v) => ({
      productId: v.productId,
      variantId: v.variantId,
      name: `${v.productName} - ${v.variantName}`,
      sku: v.sku,
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold,
      image: getThumbnailUrl(v.images),
    })),
  ]
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 20);

  return {
    dateRange: { from: fromDate, to: toDate },

    salesOverview: {
      totalRevenue,
      ordersCount: totalOrdersCount,
      completedOrdersCount,
      averageOrderValue: Number(averageOrderValue.toFixed(2)),
    },

    orderStatusBreakdown: statusGroups.map((g) => ({
      status: g.status,
      count: g._count._all,
      value: Number(g._sum.total ?? 0),
    })),

    channelBreakdown: channelGroups.map((g) => ({
      channel: g.channel,
      count: g._count._all,
      revenue: Number(g._sum.total ?? 0),
    })),

    lowStockAlerts,
    topSellingProducts,

    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customer?.name ?? "Walk-in",
      channel: o.channel,
      status: o.status,
      total: Number(o.total),
      createdAt: o.createdAt,
    })),
  };
}
