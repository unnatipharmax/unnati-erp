// src/lib/excelUtils.ts
// npm install exceljs
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

const LEDGER_DIR = path.join(process.cwd(), "public", "ledgers");
if (!fs.existsSync(LEDGER_DIR)) fs.mkdirSync(LEDGER_DIR, { recursive: true });

const C = {
  darkBg:  "FF1E2A3A",
  blueHdr: "FF2563EB",
  white:   "FFFFFFFF",
  altRow:  "FFEFF6FF",
  border:  "FFD1D5DB",
};

const thin = { style: "thin" as const, color: { argb: C.border } };
const border = { top: thin, bottom: thin, left: thin, right: thin };

function styleHeader(cell: ExcelJS.Cell, bgArgb = C.blueHdr) {
  cell.font      = { name: "Arial", bold: true, color: { argb: C.white }, size: 10 };
  cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border    = border;
}

function styleData(
  cell: ExcelJS.Cell,
  opts: { fmt?: string; align?: ExcelJS.Alignment["horizontal"]; bold?: boolean; bg?: string } = {}
) {
  cell.font      = { name: "Arial", size: 10, bold: opts.bold ?? false };
  cell.alignment = { horizontal: opts.align ?? "left", vertical: "middle" };
  cell.border    = border;
  if (opts.fmt) cell.numFmt = opts.fmt;
  if (opts.bg)  cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: opts.bg } };
}

// ── Create fresh ledger on multi-link creation ────────────────────────────────
export async function createClientLedger(params: {
  accountId:      string;
  accountName:    string;
  openingBalance: number;
  token:          string;
  orderUrl:       string;
  createdAt?:     Date;
}): Promise<string> {
  const { accountId, accountName, openingBalance, token, orderUrl, createdAt } = params;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Unnati Pharmax ERP";
  wb.created = new Date();

  // ── Sheet 1: Client Summary ─────────────────────────────────────────────────
  const ws1 = wb.addWorksheet("Client Summary");
  ws1.properties.defaultRowHeight = 20;

  // Title
  ws1.mergeCells("A1:F1");
  const title = ws1.getCell("A1");
  title.value     = "UNNATI PHARMAX — CLIENT LEDGER";
  title.font      = { name: "Arial", bold: true, size: 14, color: { argb: C.white } };
  title.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C.darkBg } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(1).height = 36;

  // Info block
  const info: [string, string | number][] = [
    ["Client Name",           accountName],
    ["Account ID",            accountId],
    ["Opening Balance (₹)",   openingBalance],
    ["Order Link Token",      token],
    ["Order URL",             orderUrl],
    ["Created On",            (createdAt ?? new Date()).toLocaleDateString("en-IN")],
  ];
  info.forEach(([label, val], i) => {
    const row = i + 2;
    ws1.mergeCells(`A${row}:B${row}`);
    const lc = ws1.getCell(`A${row}`);
    lc.value = label;
    lc.font  = { name: "Arial", bold: true, size: 10 };
    lc.border = border;
    ws1.mergeCells(`C${row}:F${row}`);
    const vc = ws1.getCell(`C${row}`);
    vc.value  = val;
    vc.font   = { name: "Arial", size: 10 };
    vc.border = border;
    if (label.includes("Balance")) {
      vc.numFmt = "₹#,##0.00";
      vc.alignment = { horizontal: "right" };
    }
  });

  ws1.getRow(8).height = 10; // spacer

  // Live summary stats — row 9 headers, row 10 formulas
  const statHdrs = ["Opening Balance (₹)", "Total Orders", "Total Spent (₹)", "Remaining Balance (₹)"];
  statHdrs.forEach((h, i) => {
    const cell = ws1.getCell(9, i + 1);
    cell.value = h;
    styleHeader(cell);
  });
  ws1.getRow(9).height = 26;

  // Formulas reference the Transactions sheet
  const statFormulas: [ExcelJS.CellFormulaValue, string][] = [
    [{ formula: "C4"                                               }, "₹#,##0.00"],
    [{ formula: "COUNTA(Transactions!A2:A1000000)"                 }, "0"        ],
    [{ formula: "IFERROR(SUM(Transactions!F2:F1000000),0)"         }, "₹#,##0.00"],
    [{ formula: "IFERROR(A10-C10,A10)"                             }, "₹#,##0.00"],
  ];
  statFormulas.forEach(([formula, fmt], i) => {
    const cell = ws1.getCell(10, i + 1);
    cell.value = formula;
    styleData(cell, { fmt, align: "right" });
  });
  ws1.getRow(10).height = 22;

  [24, 24, 24, 24, 24, 24].forEach((w, i) => { ws1.getColumn(i + 1).width = w; });
  ws1.views = [{ state: "frozen", ySplit: 10 }];

  // ── Sheet 2: Transactions ───────────────────────────────────────────────────
  const ws2 = wb.addWorksheet("Transactions");
  ws2.properties.defaultRowHeight = 20;

  const headers = [
    "Order Date", "Order ID", "Products", "Total Qty",
    "Shipment Mode", "Order Value (₹)",
    "Balance Before (₹)", "Balance After (₹)",
    "Status", "Notes",
  ];
  headers.forEach((h, i) => {
    const cell = ws2.getCell(1, i + 1);
    cell.value = h;
    styleHeader(cell);
  });
  ws2.getRow(1).height = 26;

  const colWidths = [14, 36, 40, 10, 15, 18, 20, 20, 12, 28];
  colWidths.forEach((w, i) => { ws2.getColumn(i + 1).width = w; });
  ws2.views = [{ state: "frozen", ySplit: 1 }];

  const filename = `ledger_${accountId}.xlsx`;
  await wb.xlsx.writeFile(path.join(LEDGER_DIR, filename));
  return filename;
}

// ── Append one order row (called from order-entry API) ────────────────────────
export async function appendOrderToLedger(
  filename: string,
  row: {
    orderDate:    string;
    orderId:      string;
    products:     string;   // "ProductA x2, ProductB x1"
    totalQty:     number;
    shipmentMode: string;
    orderValue:   number;
    balanceBefore: number;
    balanceAfter:  number;
    status?:      string;
    notes?:       string;
  }
): Promise<void> {
  const filepath = path.join(LEDGER_DIR, filename);
  if (!fs.existsSync(filepath)) throw new Error(`Ledger file not found: ${filename}`);

  const wb  = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filepath);

  const ws2    = wb.getWorksheet("Transactions")!;
  const nextRow = (ws2.lastRow?.number ?? 1) + 1;
  const isAlt   = nextRow % 2 === 0;

  const values = [
    row.orderDate,
    row.orderId,
    row.products,
    row.totalQty,
    row.shipmentMode,
    row.orderValue,
    row.balanceBefore,
    row.balanceAfter,
    row.status  ?? "PLACED",
    row.notes   ?? "",
  ];

  const excelRow = ws2.getRow(nextRow);
  values.forEach((val, i) => {
    const cell = excelRow.getCell(i + 1);
    cell.value = val;
    const isCurrency = [5, 6, 7].includes(i);
    styleData(cell, {
      fmt:   isCurrency ? "₹#,##0.00" : undefined,
      align: isCurrency ? "right" : i === 3 ? "center" : "left",
      bg:    isAlt ? C.altRow : undefined,
    });
  });
  excelRow.height = 20;
  excelRow.commit();

  await wb.xlsx.writeFile(filepath);
}

// ── Generate a fresh ledger from DB data (re-download anytime) ────────────────
export async function regenerateLedger(params: {
  accountId:      string;
  accountName:    string;
  openingBalance: number;
  token:          string;
  orderUrl:       string;
  createdAt:      Date;
  orders: {
    orderId:      string;
    placedAt:     Date;
    products:     string;
    totalQty:     number;
    shipmentMode: string;
    orderValue:   number;
    balanceBefore: number;
    balanceAfter:  number;
    status:       string;
    notes?:       string | null;
  }[];
}): Promise<string> {
  // Delete existing file so createClientLedger starts fresh
  const filepath = path.join(LEDGER_DIR, `ledger_${params.accountId}.xlsx`);
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);

  const filename = await createClientLedger({
    accountId:      params.accountId,
    accountName:    params.accountName,
    openingBalance: params.openingBalance,
    token:          params.token,
    orderUrl:       params.orderUrl,
    createdAt:      params.createdAt,
  });

  // Append every past order
  for (const o of params.orders) {
    await appendOrderToLedger(filename, {
      orderDate:    o.placedAt.toLocaleDateString("en-IN"),
      orderId:      o.orderId,
      products:     o.products,
      totalQty:     o.totalQty,
      shipmentMode: o.shipmentMode,
      orderValue:   o.orderValue,
      balanceBefore: o.balanceBefore,
      balanceAfter:  o.balanceAfter,
      status:       o.status,
      notes:        o.notes ?? "",
    });
  }

  return filename;
}

export { LEDGER_DIR };