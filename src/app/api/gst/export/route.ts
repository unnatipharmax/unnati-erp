// GET /api/gst/export?from=YYYY-MM-DD&to=YYYY-MM-DD
// Generates a GST filing workbook (GSTR-3B summary, GSTR-2B purchase/ITC,
// GSTR-1 sales/exports, Expense GST) for the chosen period.
//
// Notes on tax treatment:
//  • Exports are zero-rated under LUT (no output IGST). Sales appear at value
//    with zero output tax — this matches the company's export invoices.
//  • Purchase GST (CGST/SGST/IGST) is the Input Tax Credit (ITC) claimable.
//  • GSTR-3B net payable = Output tax (0 for exports) − ITC.
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";
import { getPurchaseBillAmount, roundMoney } from "../../../../lib/purchaseAccounting";
import { PurchaseDocumentType } from "@prisma/client";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

// Company GSTIN (from the export invoices) — used to label the filing.
const COMPANY_GSTIN = "27FNXPP3883B1ZA";
const COMPANY_NAME = "UNNATI PHARMAX";

function parseDate(s: string | null, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  // Default period: current month
  const now = new Date();
  const defFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const from = parseDate(searchParams.get("from"), defFrom);
  const to = parseDate(searchParams.get("to"), defTo);
  // make `to` inclusive of the whole day
  to.setHours(23, 59, 59, 999);

  const periodLabel = `${from.toLocaleDateString("en-IN")} – ${to.toLocaleDateString("en-IN")}`;

  // ── 1. PURCHASES (GSTR-2B / ITC) ───────────────────────────────────────────
  // Use invoiceDate when present, else createdAt, to bucket into the period.
  const purchaseBills = await prisma.purchaseBill.findMany({
    where: {
      documentType: PurchaseDocumentType.BILL,
      OR: [
        { invoiceDate: { gte: from, lte: to } },
        { AND: [{ invoiceDate: null }, { createdAt: { gte: from, lte: to } }] },
      ],
    },
    orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, invoiceNo: true, invoiceDate: true, createdAt: true, totalAmount: true,
      party: { select: { name: true, gstNumber: true } },
      items: {
        select: {
          quantity: true, rate: true, gstPercent: true,
          taxableAmount: true, cgstAmount: true, sgstAmount: true, igstAmount: true,
          product: { select: { name: true, hsn: true } },
        },
      },
    },
  });

  type PurchaseRow = {
    invoiceNo: string; invoiceDate: string; vendor: string; gstin: string;
    taxable: number; cgst: number; sgst: number; igst: number; total: number; itc: number;
  };
  const purchaseRows: PurchaseRow[] = [];
  let pTaxable = 0, pCgst = 0, pSgst = 0, pIgst = 0, pTotal = 0;

  for (const b of purchaseBills) {
    let taxable = 0, cgst = 0, sgst = 0, igst = 0;
    for (const it of b.items) {
      const qty = it.quantity ?? 0;
      const rate = it.rate ?? 0;
      const lineTaxable = it.taxableAmount != null ? Number(it.taxableAmount) : qty * rate;
      taxable += lineTaxable;
      cgst += it.cgstAmount != null ? Number(it.cgstAmount) : 0;
      sgst += it.sgstAmount != null ? Number(it.sgstAmount) : 0;
      igst += it.igstAmount != null ? Number(it.igstAmount) : 0;
    }
    // If GST amounts weren't recorded per item, fall back to bill-level estimate.
    const recordedTax = cgst + sgst + igst;
    const billTotal = b.totalAmount != null ? Number(b.totalAmount) : getPurchaseBillAmount(b.items);
    taxable = roundMoney(taxable);
    cgst = roundMoney(cgst); sgst = roundMoney(sgst); igst = roundMoney(igst);
    const total = roundMoney(billTotal);
    const itc = roundMoney(recordedTax); // ITC = total GST paid to vendor

    purchaseRows.push({
      invoiceNo: b.invoiceNo ?? "—",
      invoiceDate: (b.invoiceDate ?? b.createdAt).toLocaleDateString("en-IN"),
      vendor: b.party.name,
      gstin: b.party.gstNumber ?? "",
      taxable, cgst, sgst, igst, total, itc,
    });
    pTaxable += taxable; pCgst += cgst; pSgst += sgst; pIgst += igst; pTotal += total;
  }
  pTaxable = roundMoney(pTaxable); pCgst = roundMoney(pCgst); pSgst = roundMoney(pSgst);
  pIgst = roundMoney(pIgst); pTotal = roundMoney(pTotal);
  const purchaseItc = roundMoney(pCgst + pSgst + pIgst);
  const totalITC = purchaseItc; // purchase-only ITC (used in GSTR-2B sheet)

  // ── 2. SALES / EXPORTS (GSTR-1) ────────────────────────────────────────────
  // Exports under LUT → zero-rated. Value reported, output tax = 0.
  const orders = await prisma.orderInitiation.findMany({
    where: {
      status: { in: ["DISPATCHED", "PACKING"] },
      invoiceNo: { not: null },
      OR: [
        { invoiceGeneratedAt: { gte: from, lte: to } },
        { AND: [{ invoiceGeneratedAt: null }, { createdAt: { gte: from, lte: to } }] },
      ],
    },
    orderBy: [{ invoiceGeneratedAt: "asc" }, { createdAt: "asc" }],
    select: {
      invoiceNo: true, invoiceGeneratedAt: true, createdAt: true,
      fullName: true, country: true, currency: true,
      dollarAmount: true, inrAmount: true, amountPaid: true, exchangeRate: true,
    },
  });

  type SalesRow = {
    invoiceNo: string; date: string; customer: string; country: string;
    currency: string; fcValue: number; exRate: number; inrValue: number; outputTax: number;
  };
  const salesRows: SalesRow[] = [];
  let sInr = 0;
  for (const o of orders) {
    const exRate = o.exchangeRate ? Number(o.exchangeRate) : 84;
    const fcValue = o.dollarAmount != null ? Number(o.dollarAmount) : Number(o.amountPaid);
    const inrValue = o.inrAmount != null && Number(o.inrAmount) > 0
      ? Number(o.inrAmount)
      : roundMoney(fcValue * exRate);
    salesRows.push({
      invoiceNo: o.invoiceNo ?? "—",
      date: (o.invoiceGeneratedAt ?? o.createdAt).toLocaleDateString("en-IN"),
      customer: o.fullName,
      country: o.country,
      currency: o.currency,
      fcValue: roundMoney(fcValue),
      exRate,
      inrValue: roundMoney(inrValue),
      outputTax: 0, // zero-rated export under LUT
    });
    sInr += inrValue;
  }
  sInr = roundMoney(sInr);

  // ── 3. EXPENSES with GST (read via raw SQL — GST columns added post-migration) ──
  type ExpenseRow = {
    category: string; description: string; amount: number; expenseDate: Date;
    paymentMode: string | null; vendorName: string | null; vendorGstin: string | null;
    billNo: string | null; taxableAmount: number | null; gstPercent: number | null;
    gstAmount: number | null; itcEligible: boolean | null;
  };
  const expenses = await prisma.$queryRaw<ExpenseRow[]>`
    SELECT category, description, amount, "expenseDate", "paymentMode",
           "vendorName", "vendorGstin", "billNo", "taxableAmount",
           "gstPercent", "gstAmount", "itcEligible"
    FROM "Expense"
    WHERE "expenseDate" >= ${from} AND "expenseDate" <= ${to}
    ORDER BY "expenseDate" ASC
  `;
  const expTotal = roundMoney(expenses.reduce((s, e) => s + Number(e.amount), 0));
  // Expense ITC = GST amount on expenses explicitly marked ITC-eligible
  const expenseItc = roundMoney(
    expenses.reduce((s, e) => s + (e.itcEligible && e.gstAmount != null ? Number(e.gstAmount) : 0), 0)
  );
  // Combined credit available = purchase ITC + ITC-eligible expense GST
  const grandITC = roundMoney(purchaseItc + expenseItc);

  // ── Build the workbook ─────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = "Unnati Pharmax ERP";
  wb.created = new Date();

  const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A3A6B" } };
  const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  const TOTAL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
  const MONEY = '#,##0.00';

  function header(ws: ExcelJS.Worksheet, headers: string[]) {
    const row = ws.getRow(1);
    headers.forEach((h, i) => {
      const cell = row.getCell(i + 1);
      cell.value = h;
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    row.height = 24;
    ws.autoFilter = { from: "A1", to: { row: 1, column: headers.length } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }

  // ── Sheet: Cover ───────────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Cover");
    ws.columns = [{ width: 28 }, { width: 50 }];
    const rows: [string, string][] = [
      ["GST FILING WORKBOOK", ""],
      ["Company", COMPANY_NAME],
      ["GSTIN", COMPANY_GSTIN],
      ["Period", periodLabel],
      ["Generated", new Date().toLocaleString("en-IN")],
      ["", ""],
      ["GSTR-3B — Output tax (exports, zero-rated under LUT)", "₹ 0.00"],
      ["GSTR-3B — ITC from purchases", `₹ ${purchaseItc.toLocaleString("en-IN")}`],
      ["GSTR-3B — ITC from expenses (eligible)", `₹ ${expenseItc.toLocaleString("en-IN")}`],
      ["GSTR-3B — Total Input Tax Credit", `₹ ${grandITC.toLocaleString("en-IN")}`],
      ["GSTR-3B — Net GST payable", `₹ ${roundMoney(0 - grandITC).toLocaleString("en-IN")} (credit carry-forward)`],
      ["", ""],
      ["Sales / Exports (value, INR)", `₹ ${sInr.toLocaleString("en-IN")}`],
      ["Purchases (taxable value, INR)", `₹ ${pTaxable.toLocaleString("en-IN")}`],
      ["Expenses (total, INR)", `₹ ${expTotal.toLocaleString("en-IN")}`],
      ["", ""],
      ["NOTE", "Exports are zero-rated under LUT — no output IGST. Output tax is 0, so net GST is a credit (ITC) carry-forward. Verify with your CA before filing."],
    ];
    rows.forEach((r, i) => {
      const row = ws.addRow(r);
      if (i === 0) { row.font = { bold: true, size: 14, color: { argb: "FF7A5C00" } }; row.height = 26; }
      else row.getCell(1).font = { bold: true };
    });
  }

  // ── Sheet: GSTR-3B Summary ─────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("GSTR-3B Summary");
    ws.columns = [{ width: 48 }, { width: 20 }];
    header(ws, ["Particulars", "Amount (₹)"]);
    const add = (label: string, val: number, bold = false) => {
      const r = ws.addRow([label, val]);
      r.getCell(2).numFmt = MONEY;
      if (bold) { r.font = { bold: true }; r.eachCell(c => { c.fill = TOTAL_FILL; }); }
    };
    add("3.1(b) Outward zero-rated supplies (exports under LUT) — Taxable value", sInr);
    add("3.1(b) Output IGST on zero-rated supplies (LUT, no tax)", 0);
    ws.addRow([]);
    add("4(A)(5) ITC — IGST (purchases)", pIgst);
    add("4(A)(5) ITC — CGST (purchases)", pCgst);
    add("4(A)(5) ITC — SGST (purchases)", pSgst);
    add("4(A)(5) ITC — Expenses (eligible)", expenseItc);
    add("4(A) Total ITC available", grandITC, true);
    ws.addRow([]);
    add("Total output tax payable", 0, true);
    add("Net GST payable (output − ITC)", roundMoney(0 - grandITC), true);
    ws.addRow([]);
    const note = ws.addRow(["Net is negative → ITC carries forward as credit. Confirm with CA.", ""]);
    note.getCell(1).font = { italic: true, color: { argb: "FF8A6D00" } };
  }

  // ── Sheet: GSTR-2B (Purchases / ITC) ───────────────────────────────────────
  {
    const ws = wb.addWorksheet("GSTR-2B Purchases");
    ws.columns = [
      { width: 8 }, { width: 18 }, { width: 14 }, { width: 28 }, { width: 22 },
      { width: 15 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 15 }, { width: 14 },
    ];
    header(ws, ["#", "Invoice No.", "Inv. Date", "Vendor", "Vendor GSTIN",
      "Taxable (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Total (₹)", "ITC (₹)"]);
    purchaseRows.forEach((r, i) => {
      const row = ws.addRow([i + 1, r.invoiceNo, r.invoiceDate, r.vendor, r.gstin,
        r.taxable, r.cgst, r.sgst, r.igst, r.total, r.itc]);
      [6, 7, 8, 9, 10, 11].forEach(c => { row.getCell(c).numFmt = MONEY; });
      if (!r.gstin) row.getCell(5).font = { color: { argb: "FFCC0000" }, italic: true };
    });
    const tr = ws.addRow(["", "", "", "", "TOTAL", pTaxable, pCgst, pSgst, pIgst, pTotal, totalITC]);
    tr.font = { bold: true };
    [6, 7, 8, 9, 10, 11].forEach(c => { tr.getCell(c).numFmt = MONEY; });
    tr.eachCell(c => { c.fill = TOTAL_FILL; });
  }

  // ── Sheet: GSTR-1 (Sales / Exports) ────────────────────────────────────────
  {
    const ws = wb.addWorksheet("GSTR-1 Exports");
    ws.columns = [
      { width: 8 }, { width: 16 }, { width: 14 }, { width: 28 }, { width: 18 },
      { width: 10 }, { width: 15 }, { width: 12 }, { width: 16 }, { width: 14 },
    ];
    header(ws, ["#", "Invoice No.", "Inv. Date", "Customer", "Country",
      "Currency", "FC Value", "Ex. Rate", "INR Value", "Output Tax (₹)"]);
    salesRows.forEach((r, i) => {
      const row = ws.addRow([i + 1, r.invoiceNo, r.date, r.customer, r.country,
        r.currency, r.fcValue, r.exRate, r.inrValue, r.outputTax]);
      [7, 9, 10].forEach(c => { row.getCell(c).numFmt = MONEY; });
      row.getCell(8).numFmt = "0.0000";
    });
    const tr = ws.addRow(["", "", "", "", "", "", "", "TOTAL", sInr, 0]);
    tr.font = { bold: true };
    [9, 10].forEach(c => { tr.getCell(c).numFmt = MONEY; });
    tr.eachCell(c => { c.fill = TOTAL_FILL; });
    ws.addRow([]);
    const note = ws.addRow(["", "Zero-rated exports under LUT — no output IGST charged."]);
    note.getCell(2).font = { italic: true, color: { argb: "FF8A6D00" } };
  }

  // ── Sheet: Expense GST ─────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Expenses");
    ws.columns = [
      { width: 6 }, { width: 13 }, { width: 14 }, { width: 32 }, { width: 22 }, { width: 20 },
      { width: 14 }, { width: 14 }, { width: 10 }, { width: 13 }, { width: 13 }, { width: 11 }, { width: 13 },
    ];
    header(ws, ["#", "Date", "Category", "Description", "Vendor", "Vendor GSTIN",
      "Bill No.", "Taxable (₹)", "GST %", "GST (₹)", "Total (₹)", "ITC?", "Payment Mode"]);
    let eTaxable = 0, eGst = 0;
    expenses.forEach((e, i) => {
      const gross = roundMoney(Number(e.amount));
      const taxable = e.taxableAmount != null ? roundMoney(Number(e.taxableAmount)) : null;
      const gst = e.gstAmount != null ? roundMoney(Number(e.gstAmount)) : null;
      const itc = !!e.itcEligible;
      eTaxable += taxable ?? 0;
      eGst += itc && gst != null ? gst : 0;
      const row = ws.addRow([
        i + 1, e.expenseDate.toLocaleDateString("en-IN"), e.category, e.description,
        e.vendorName ?? "", e.vendorGstin ?? "", e.billNo ?? "",
        taxable ?? "", e.gstPercent ?? "", gst ?? "", gross, itc ? "Yes" : "No", e.paymentMode ?? "",
      ]);
      [8, 10, 11].forEach(c => { row.getCell(c).numFmt = MONEY; });
      if (itc && !e.vendorGstin) row.getCell(6).font = { color: { argb: "FFCC0000" }, italic: true };
    });
    const tr = ws.addRow(["", "", "", "", "", "", "TOTAL",
      roundMoney(eTaxable), "", roundMoney(eGst), expTotal, "", ""]);
    tr.font = { bold: true };
    [8, 10, 11].forEach(c => { tr.getCell(c).numFmt = MONEY; });
    tr.eachCell(c => { c.fill = TOTAL_FILL; });
    ws.addRow([]);
    const note = ws.addRow(["", `ITC-eligible expense GST = ₹${expenseItc.toLocaleString("en-IN")} (included in GSTR-3B total ITC). Only rows marked ITC=Yes with a vendor GSTIN are claimed.`]);
    note.getCell(2).font = { italic: true, color: { argb: "FF047857" } };
  }

  const buf = await wb.xlsx.writeBuffer();
  const fname = `GST-Filing_${from.toISOString().split("T")[0]}_to_${to.toISOString().split("T")[0]}.xlsx`;
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
