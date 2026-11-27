import prisma from "../../config/db.js";
import { Prisma, OrderChannel, OrderStatus } from "@prisma/client";
import { fail } from "../../utils/fail.js";

// ==================== TYPES ====================

export interface InvoiceTaxLine {
  name: string;
  rate: number;
  amount: number;
}

export interface InvoiceItemSnapshot {
  orderItemId: string;
  name: string;
  sku: string;
  hsnCode: string | null;
  quantity: number;
  price: number;
  subtotal: number;
  taxAmount: number;
  taxes: InvoiceTaxLine[];
}

export interface InvoiceSnapshot {
  seller: {
    businessName: string;
    legalName: string | null;
    gstin: string | null;
    address: string | null;
    state: string | null;
    country: string | null;
    phone: string | null;
    email: string | null;
  };
  buyer: { name: string; phone: string; email: string | null };
  address: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  } | null;
  order: {
    orderNumber: string;
    orderDate: string;
    isExchange: boolean;
    couponCode: string | null;
  };
  currency: string;
  items: InvoiceItemSnapshot[];
  totals: {
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    exchangeCredit: number | null; // sirf exchange order: purane item ki value
  };
}

interface InvoiceViewer {
  isCustomer: boolean;
}

interface InvoiceEligibilityOrder {
  channel: OrderChannel;
  status: OrderStatus;
  deliveredAt: Date | null;
  invoice?: { invoiceNumber: string } | null;
}

// ==================== ELIGIBILITY ====================

export function canDownloadInvoice(
  order: InvoiceEligibilityOrder,
  viewer: InvoiceViewer,
): boolean {
  if (order.channel !== OrderChannel.ONLINE) return false;

  // deliveredAt return/refund ke baad bhi rehta hai, isliye invoice band nahi hota
  const delivered =
    !!order.deliveredAt || order.status === OrderStatus.COMPLETED;
  if (viewer.isCustomer) return delivered;

  return (
    delivered || !!order.invoice || order.status === OrderStatus.PROCESSING
  );
}

// ==================== NUMBERING ====================

// Indian financial year (April-March), IST ke hisaab se: "2026-27"
export function getFinancialYear(date: Date): string {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const year = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

// Counter row transaction khatam hone tak locked rehta hai:
// do requests ko same number nahi milega, aur rollback par number waste nahi hoga
async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  financialYear: string,
  prefix: string,
): Promise<string> {
  await tx.$executeRaw`
    INSERT INTO invoice_counters (financialYear, lastNumber)
    VALUES (${financialYear}, 1)
    ON DUPLICATE KEY UPDATE lastNumber = lastNumber + 1`;

  const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
    SELECT lastNumber FROM invoice_counters
    WHERE financialYear = ${financialYear} FOR UPDATE`;

  const shortYear = financialYear.slice(2).replace("-", ""); // "2627"
  const serial = String(Number(rows[0].lastNumber)).padStart(6, "0");
  return `${prefix}-${shortYear}-${serial}`; // max 15 chars (limit 16)
}

// ==================== CREATE (idempotent) ====================

export async function createInvoiceTx(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  // Order row lock: ek order ke do invoice nahi banenge.
  // Lazy path mein ye transaction ki PEHLI query honi chahiye.
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;

  const existing = await tx.invoice.findUnique({ where: { orderId } });
  if (existing) return existing;

  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      orderItems: {
        include: {
          product: { select: { name: true, sku: true, hsnCode: true } },
          variant: { select: { name: true, sku: true } },
        },
      },
      customer: { select: { name: true, phone: true, email: true } },
      address: true,
      coupon: { select: { code: true } },
      exchangeReturnRequests: { select: { originalValue: true } },
    },
  });
  if (!order) return fail("Order not found", 404);
  const customer = order.customer ?? fail("Order has no customer");

  const settings =
    (await tx.storeSettings.findFirst()) ??
    fail("Configure store settings before generating invoices");

  const exchangeCredit = order.isExchange
    ? (order.exchangeReturnRequests[0]?.originalValue ?? null)
    : null;

  const snapshot: InvoiceSnapshot = {
    seller: {
      businessName: settings.businessName,
      legalName: settings.legalName,
      gstin: settings.gstin,
      address: settings.address,
      state: settings.state,
      country: settings.country,
      phone: settings.phone,
      email: settings.email,
    },
    buyer: {
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
    },
    address: order.address
      ? {
          line1: order.address.line1,
          line2: order.address.line2,
          city: order.address.city,
          state: order.address.state,
          postalCode: order.address.postalCode,
          country: order.address.country,
        }
      : null,
    order: {
      orderNumber: order.orderNumber,
      orderDate: order.createdAt.toISOString(),
      isExchange: order.isExchange,
      couponCode: order.coupon?.code ?? null,
    },
    currency: settings.currency,
    items: order.orderItems.map((item) => ({
      orderItemId: item.id,
      name: item.variant?.name
        ? `${item.product.name} - ${item.variant.name}`
        : item.product.name,
      sku: item.variant?.sku ?? item.product.sku,
      hsnCode: item.product.hsnCode,
      quantity: item.quantity,
      price: Number(item.price),
      subtotal: Number(item.subtotal),
      taxAmount: Number(item.taxAmount),
      taxes: Array.isArray(item.taxBreakdown)
        ? (item.taxBreakdown as unknown as InvoiceTaxLine[])
        : [],
    })),
    totals: {
      subtotal: Number(order.subtotal),
      tax: Number(order.tax),
      discount: Number(order.discount),
      total: Number(order.total),
      exchangeCredit: exchangeCredit === null ? null : Number(exchangeCredit),
    },
  };

  const issuedAt = new Date();
  const financialYear = getFinancialYear(issuedAt);
  const invoiceNumber = await nextInvoiceNumber(
    tx,
    financialYear,
    settings.invoicePrefix,
  );

  return tx.invoice.create({
    data: {
      orderId,
      invoiceNumber,
      financialYear,
      issuedAt,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
  });
}

// ==================== READ FOR DOWNLOAD ====================

export async function getInvoiceForDownload(
  orderId: string,
  customerId?: string,
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { invoice: true },
  });

  // dusre customer ko 404: order ka hona bhi pata na chale
  if (!order || (customerId && order.customerId !== customerId)) {
    return fail("Order not found", 404);
  }
  if (order.channel !== OrderChannel.ONLINE) {
    return fail("Invoice download is only for online orders. Use the POS receipt.");
  }
  if (!canDownloadInvoice(order, { isCustomer: !!customerId })) {
    return fail(
      customerId
        ? "Invoice will be available after your order is delivered"
        : "Invoice is available once the order is in PROCESSING",
      403,
    );
  }

  // purane orders / jinka invoice abhi nahi bana: pehle download par banega
  const invoice =
    order.invoice ??
    (await prisma.$transaction((tx) => createInvoiceTx(tx, orderId)));

  // ye data LIVE hai (snapshot nahi): payment status, return, refund
  const [payments, refunds, returnedItems] = await Promise.all([
    prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.refund.findMany({
      where: { orderId, amount: { gt: 0 } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.orderItem.findMany({
      where: { orderId, returnedQty: { gt: 0 } },
      select: { id: true, returnedQty: true },
    }),
  ]);

  return {
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.issuedAt,
    snapshot: invoice.snapshot as unknown as InvoiceSnapshot,
    live: {
      orderStatus: order.status,
      payments: payments.map((p) => ({
        method: p.method,
        status: p.status,
        amount: Number(p.amount),
      })),
      refunds: refunds.map((r) => ({
        amount: Number(r.amount),
        method: r.method,
        status: r.status,
        date: r.createdAt,
      })),
      returnedQty: Object.fromEntries(
        returnedItems.map((i) => [i.id, i.returnedQty]),
      ) as Record<string, number>,
    },
  };
}

export type InvoiceDocument = Awaited<ReturnType<typeof getInvoiceForDownload>>;