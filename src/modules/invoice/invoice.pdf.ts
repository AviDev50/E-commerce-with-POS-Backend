import PDFDocument from "pdfkit";
import { createRequire } from "node:module";
import type { InvoiceDocument } from "./invoice.service.js";

const require = createRequire(import.meta.url);
// ₹ symbol ke liye Unicode font (npm: dejavu-fonts-ttf)
const FONT = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf");
const FONT_BOLD = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf");

const LEFT = 40;
const WIDTH = 515; // A4 595 - 2*40
const BOTTOM = 790;

const COLUMNS = [
  { title: "#", width: 22, align: "left" },
  { title: "Item", width: 183, align: "left" },
  { title: "Qty", width: 30, align: "right" },
  { title: "Rate", width: 65, align: "right" },
  { title: "Amount", width: 70, align: "right" },
  { title: "Tax", width: 70, align: "right" },
  { title: "Total", width: 75, align: "right" },
] as const;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

// Tax naam+rate ke hisaab se group; paise ka rounding farak aakhri line mein adjust
function summariseTaxes(doc: InvoiceDocument) {
  const map = new Map<string, { label: string; amount: number }>();
  for (const item of doc.snapshot.items) {
    for (const t of item.taxes) {
      const label = `${t.name} @ ${t.rate}%`;
      const row = map.get(label) ?? { label, amount: 0 };
      row.amount += t.amount;
      map.set(label, row);
    }
  }
  const rows = [...map.values()].map((r) => ({ ...r, amount: round2(r.amount) }));
  const { tax } = doc.snapshot.totals;
  if (rows.length === 0) {
    return tax > 0 ? [{ label: "Tax", amount: tax }] : [];
  }
  const diff = round2(tax - rows.reduce((s, r) => s + r.amount, 0));
  rows[rows.length - 1].amount = round2(rows[rows.length - 1].amount + diff);
  return rows;
}

export function renderInvoicePdf(data: InvoiceDocument): Promise<Buffer> {
  const { snapshot, live } = data;
  const { seller, buyer, address, totals } = snapshot;

  const money = (n: number) => {
    const value = Math.abs(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const symbol = snapshot.currency === "INR" ? "₹" : `${snapshot.currency} `;
    return `${n < 0 ? "-" : ""}${symbol}${value}`;
  };

  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: "A4",
      margin: LEFT,
      bufferPages: true,
      info: { Title: `Invoice ${data.invoiceNumber}` },
    });
    const chunks: Buffer[] = [];
    pdf.on("data", (c: Buffer) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    pdf.registerFont("regular", FONT);
    pdf.registerFont("bold", FONT_BOLD);

    let y = LEFT;

    const text = (
      value: string,
      x: number,
      top: number,
      width: number,
      opts: { bold?: boolean; size?: number; align?: "left" | "right" | "center"; color?: string } = {},
    ) => {
      pdf
        .font(opts.bold ? "bold" : "regular")
        .fontSize(opts.size ?? 8.5)
        .fillColor(opts.color ?? "#111111")
        .text(value, x, top, { width, align: opts.align ?? "left" });
      return pdf.y;
    };
    const height = (value: string, width: number, size = 8.5, bold = false) =>
      pdf.font(bold ? "bold" : "regular").fontSize(size).heightOfString(value, { width });
    const rule = (top: number) =>
      pdf.moveTo(LEFT, top).lineTo(LEFT + WIDTH, top).lineWidth(0.5).strokeColor("#999999").stroke();
    const ensureSpace = (needed: number) => {
      if (y + needed <= BOTTOM) return false;
      pdf.addPage();
      y = LEFT;
      return true;
    };

    // ---------- Header: seller (left) + invoice meta (right) ----------
    let leftY = text(seller.businessName, LEFT, y, 300, { bold: true, size: 15 });
    const sellerLines = [
      seller.legalName && seller.legalName !== seller.businessName ? seller.legalName : null,
      seller.address,
      [seller.state, seller.country].filter(Boolean).join(", ") || null,
      seller.phone ? `Phone: ${seller.phone}` : null,
      seller.email ? `Email: ${seller.email}` : null,
      seller.gstin ? `GSTIN: ${seller.gstin}` : null,
    ].filter(Boolean) as string[];
    for (const line of sellerLines) leftY = text(line, LEFT, leftY + 2, 300);

    let rightY = text(seller.gstin ? "TAX INVOICE" : "INVOICE", 355, y, 200, {
      bold: true, size: 15, align: "right",
    });
    const meta = [
      `Invoice No: ${data.invoiceNumber}`,
      `Invoice Date: ${formatDate(data.issuedAt)}`,
      `Order No: ${snapshot.order.orderNumber}`,
      `Order Date: ${formatDate(snapshot.order.orderDate)}`,
      seller.gstin && address ? `Place of Supply: ${address.state}` : null,
      seller.gstin ? "Reverse Charge: No" : null,
      snapshot.order.isExchange ? "Exchange Order" : null,
    ].filter(Boolean) as string[];
    for (const line of meta) rightY = text(line, 355, rightY + 2, 200, { align: "right" });

    y = Math.max(leftY, rightY) + 10;
    if (live.orderStatus === "CANCELLED") {
      y = text("ORDER CANCELLED", LEFT, y, WIDTH, { bold: true, size: 12, align: "center", color: "#b00020" }) + 6;
    }
    rule(y);
    y += 8;

    // ---------- Buyer ----------
    y = text("Bill To / Ship To", LEFT, y, WIDTH, { bold: true });
    const buyerLines = [
      buyer.name,
      address ? [address.line1, address.line2].filter(Boolean).join(", ") : null,
      address ? `${address.city}, ${address.state} - ${address.postalCode}, ${address.country}` : null,
      `Phone: ${buyer.phone}${buyer.email ? `  |  Email: ${buyer.email}` : ""}`,
    ].filter(Boolean) as string[];
    for (const line of buyerLines) y = text(line, LEFT, y + 2, WIDTH);
    y += 12;

    // ---------- Items table ----------
    const drawRow = (cells: string[], top: number, bold = false) => {
      let x = LEFT;
      cells.forEach((cell, i) => {
        const col = COLUMNS[i];
        text(cell, x + 2, top, col.width - 4, { bold, align: col.align, size: 8 });
        x += col.width;
      });
    };
    const drawHeader = () => {
      pdf.rect(LEFT, y, WIDTH, 18).fill("#eeeeee");
      drawRow(COLUMNS.map((c) => c.title), y + 5, true);
      y += 23;
    };

    drawHeader();
    snapshot.items.forEach((item, index) => {
      const returned = live.returnedQty[item.orderItemId];
      const description = [
        item.name,
        `SKU: ${item.sku}${item.hsnCode ? `  |  HSN: ${item.hsnCode}` : ""}`,
        returned ? `Returned/exchanged qty: ${returned}` : null,
      ].filter(Boolean).join("\n");
      const taxCell = [
        money(item.taxAmount),
        ...item.taxes.map((t) => `${t.name} ${t.rate}%`),
      ].join("\n");

      const rowHeight = Math.max(
        height(description, COLUMNS[1].width - 4, 8),
        height(taxCell, COLUMNS[5].width - 4, 8),
      ) + 8;
      if (ensureSpace(rowHeight)) drawHeader();

      drawRow(
        [
          String(index + 1),
          description,
          String(item.quantity),
          money(item.price),
          money(item.subtotal),
          taxCell,
          money(item.subtotal + item.taxAmount),
        ],
        y,
      );
      y += rowHeight;
      rule(y - 4);
    });

    // ---------- Totals ----------
    const totalRow = (label: string, value: string, bold = false) => {
      const rowHeight = Math.max(height(label, 170, 9, bold), 12) + 4;
      ensureSpace(rowHeight);
      text(label, 290, y, 170, { bold, size: 9 });
      text(value, 460, y, 93, { bold, size: 9, align: "right" });
      y += rowHeight;
    };

    y += 4;
    totalRow("Subtotal (before tax)", money(totals.subtotal));
    for (const t of summariseTaxes(data)) totalRow(t.label, money(t.amount));
    if (totals.discount > 0) {
      const code = snapshot.order.couponCode;
      totalRow(`Discount${code ? ` (${code})` : ""}`, money(-totals.discount));
    }
    const roundOff = round2(totals.total - (totals.subtotal + totals.tax - totals.discount));
    if (roundOff !== 0) totalRow("Round off", money(roundOff));
    totalRow("Grand Total", money(totals.total), true);

    if (totals.exchangeCredit !== null) {
      totalRow("Less: exchanged item value", money(-totals.exchangeCredit));
      const net = round2(totals.total - totals.exchangeCredit);
      totalRow(net >= 0 ? "Net Payable" : "Net Refundable", money(Math.abs(net)), true);
    }

    // ---------- Payments (live status) ----------
    const section = (title: string, lines: string[]) => {
      if (lines.length === 0) return;
      ensureSpace(30);
      y = text(title, LEFT, y + 8, WIDTH, { bold: true }) + 2;
      for (const line of lines) {
        ensureSpace(14);
        y = text(line, LEFT, y, WIDTH) + 2;
      }
    };

    section(
      "Payment Details",
      live.payments.map((p) => `${p.method}: ${money(p.amount)} (${p.status})`),
    );
    section(
      "Refunds after this order (for information only, this is not a credit note)",
      live.refunds.map(
        (r) => `${formatDate(r.date)}: ${money(r.amount)}${r.method ? ` via ${r.method}` : ""} (${r.status})`,
      ),
    );

    ensureSpace(30);
    text("This is a computer-generated invoice.", LEFT, y + 14, WIDTH, {
      align: "center", color: "#666666", size: 8,
    });

    // ---------- Page numbers ----------
    const { count } = pdf.bufferedPageRange();
    for (let i = 0; i < count; i++) {
      pdf.switchToPage(i);
      pdf.page.margins.bottom = 0; // warna footer likhte hi naya page ban jata hai
      text(`Page ${i + 1} of ${count}`, LEFT, 815, WIDTH, { align: "right", size: 7, color: "#666666" });
    }

    pdf.end();
  });
}