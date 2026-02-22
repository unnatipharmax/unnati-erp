// src/lib/excelUtils.ts
// ✅ Matches Unnati Pharmax existing Excel format exactly
// ✅ 100% in-memory — no filesystem — works on Vercel
import ExcelJS from "exceljs";

// ── Colors matching your existing format ─────────────────────────────────────
const C = {
  orangeHdr:  "FFFF9900",   // orange — product/financial columns header
  amberHdr:   "FFE69138",   // amber  — customer/address columns header
  green:      "FF00FF00",   // green  — tracking number cell
  white:      "FFFFFFFF",
  black:      "FF000000",
};

const thinBorder = {
  top:    { style: "thin" as const },
  bottom: { style: "thin" as const },
  left:   { style: "thin" as const },
  right:  { style: "thin" as const },
};

function hdrCell(cell: ExcelJS.Cell, text: string, bgColor: string) {
  cell.value     = text;
  cell.font      = { name: "Arial", size: 10, bold: true };
  cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
  cell.alignment = { horizontal: "left", vertical: "middle" };
  cell.border    = thinBorder;
}

function dataCell(
  cell: ExcelJS.Cell,
  value: ExcelJS.CellValue,
  opts: { fmt?: string; align?: ExcelJS.Alignment["horizontal"]; bg?: string } = {}
) {
  cell.value     = value;
  cell.font      = { name: "Arial", size: 10 };
  cell.alignment = { horizontal: opts.align ?? "left", vertical: "middle", wrapText: false };
  cell.border    = thinBorder;
  if (opts.fmt) cell.numFmt = opts.fmt;
  if (opts.bg)  cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: opts.bg } };
}

export type OrderRow = {
  orderDate:     string;
  orderId:       string;
  fullName:      string;
  address:       string;
  city:          string;
  state:         string;
  postalCode:    string;
  country:       string;
  trackingNo?:   string | null;
  products:      { genericName: string; manufacturer: string; brandName: string; qty: number; unitPrice: number }[];
  shipmentMode:  string;
  shippingPrice: number;
  exchangeRate?: number;
  orderValue:    number;
  balanceBefore: number;
  balanceAfter:  number;
  status:        string;
  notes?:        string | null;
  paymentDate?:  string | null;
  grsNumber?:    string | null;
  dollarAmount?: number;
};

export async function generateLedgerBuffer(params: {
  accountId:      string;
  accountName:    string;
  openingBalance: number;
  token:          string;
  orderUrl:       string;
  createdAt:      Date;
  orders:         OrderRow[];
}): Promise<Buffer> {
  const { accountName, openingBalance, orders } = params;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Unnati Pharmax ERP";
  wb.created = new Date();

  const ws = wb.addWorksheet("Sheet1");
  ws.properties.defaultRowHeight = 13.2;

  // ── Column widths — exactly matching your file ──────────────────────────────
  const colDefs = [
    { key: "A", width: 13.44 },   // SR / Order ref
    { key: "B", width: 23.33 },   // Customer Name
    { key: "C", width: 40.66 },   // Shipping Address
    { key: "D", width: 20.0  },   // City
    { key: "E", width: 25.88 },   // State
    { key: "F", width: 14.88 },   // Post Code
    { key: "G", width: 16.21 },   // Country
    { key: "H", width: 13.44 },   // Tracking
    { key: "I", width: 9.44  },   // SR No
    { key: "J", width: 32.88 },   // Generic Name
    { key: "K", width: 23.21 },   // Manufacturer
    { key: "L", width: 25.88 },   // Brand Name
    { key: "M", width: 16.44 },   // Quantity
    { key: "N", width: 13.0  },   // Shipping Service
    { key: "O", width: 17.11 },   // Comments
    { key: "P", width: 12.0  },   // Price (Unit)
    { key: "Q", width: 12.0  },   // Total
    { key: "R", width: 12.0  },   // Shipping
    { key: "S", width: 12.0  },   // Total
    { key: "T", width: 12.0  },   // Exchange Rate
    { key: "U", width: 14.0  },   // INR Amount
    { key: "V", width: 12.66 },   // Balance
    { key: "W", width: 11.77 },   // Payment Date
    { key: "X", width: 30.0  },   // GRS Number
    { key: "Y", width: 14.0  },   // Dollar Amount
    { key: "Z", width: 14.0  },   // INR Amount
  ];
  colDefs.forEach(c => { ws.getColumn(c.key).width = c.width; });

  // ── Row 1: Headers ──────────────────────────────────────────────────────────
  //  A: orange (ref col), B-H: amber (customer), I-V: orange (product/finance)
  const amberCols  = ["B","C","D","E","F","G","H"];
  const orangeCols = ["A","I","J","K","L","M","N","O","P","Q","R","S","T","U","V"];

  const headers: Record<string, string> = {
    A: " ", B: "CUSTOMER NAME", C: "SHIPPING ADDRESS", D: "CITY",
    E: "STATE", F: "POST CODE ZIP", G: "COUNTRY", H: "TRACKING",
    I: "SR NO", J: "Generic name", K: "Manufacturer", L: "BRAND NAME",
    M: "Quantity", N: "Shipping Service", O: "Comments if Any",
    P: "PRICE ( UNIT )", Q: "TOTAL", R: "SHIPPING", S: "Total",
    T: "Exchange Rate", U: "INR AMOUNT", V: "BALANCE",
    W: "Payment Deposit Date", X: "GRS NUMBER", Y: "DOLLAR AMOUNT", Z: "INR AMOUNT",
  };

  Object.entries(headers).forEach(([col, text]) => {
    const bg = amberCols.includes(col) ? C.amberHdr : orangeCols.includes(col) ? C.orangeHdr : undefined;
    const cell = ws.getCell(`${col}1`);
    cell.value     = text;
    cell.font      = { name: "Arial", size: 10, bold: bg ? true : false };
    cell.alignment = { horizontal: "left", vertical: "middle" };
    cell.border    = thinBorder;
    if (bg) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
  });
  ws.getRow(1).height = 13.2;
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // ── Data rows ───────────────────────────────────────────────────────────────
  let currentRow = 2;
  let srNo       = 1;
  let runBal     = openingBalance;

  // Opening balance row
  dataCell(ws.getCell(`A${currentRow}`), "Opening Balance");
  dataCell(ws.getCell(`V${currentRow}`), openingBalance, { fmt: "#,##0.00", align: "right" });
  ws.getRow(currentRow).height = 13.2;
  currentRow++;

  for (const order of orders) {
    const productRows = order.products.length > 0 ? order.products : [{
      genericName:  order.notes ?? "Pending entry",
      manufacturer: "",
      brandName:    "",
      qty:          0,
      unitPrice:    0,
    }];

    const orderValue   = order.orderValue;
    const balBefore    = runBal;
    const balAfter     = order.status !== "INITIATED" ? balBefore - orderValue : balBefore;
    if (order.status !== "INITIATED") runBal = balAfter;

    // First product row has customer info + financials
    const firstProd    = productRows[0];
    const firstExcelRow = currentRow;

    // Col A — order ref (SR number format like RF001)
    dataCell(ws.getCell(`A${currentRow}`), `RF${String(srNo).padStart(3, "0")}`);
    dataCell(ws.getCell(`B${currentRow}`), order.fullName,    { bg: C.white });
    dataCell(ws.getCell(`C${currentRow}`), order.address,     { bg: C.white });
    dataCell(ws.getCell(`D${currentRow}`), order.city,        { bg: C.white });
    dataCell(ws.getCell(`E${currentRow}`), order.state,       { bg: C.white });
    dataCell(ws.getCell(`F${currentRow}`), order.postalCode,  { bg: C.white });
    dataCell(ws.getCell(`G${currentRow}`), order.country);

    // Tracking — green background if present
    const trackCell = ws.getCell(`H${currentRow}`);
    dataCell(trackCell, order.trackingNo ?? "", order.trackingNo ? { bg: C.green } : {});

    dataCell(ws.getCell(`I${currentRow}`), srNo, { align: "center" });
    dataCell(ws.getCell(`J${currentRow}`), firstProd.genericName);
    dataCell(ws.getCell(`K${currentRow}`), firstProd.manufacturer);
    dataCell(ws.getCell(`L${currentRow}`), firstProd.brandName);
    dataCell(ws.getCell(`M${currentRow}`), firstProd.qty,       { align: "right" });
    dataCell(ws.getCell(`N${currentRow}`), order.shipmentMode);
    dataCell(ws.getCell(`O${currentRow}`), order.notes ?? "");
    dataCell(ws.getCell(`P${currentRow}`), firstProd.unitPrice, { fmt: "0.000", align: "right" });

    // Q = P * M formula if we have a real product
    if (firstProd.qty > 0) {
      ws.getCell(`Q${currentRow}`).value = { formula: `P${currentRow}*M${currentRow}` };
    } else {
      dataCell(ws.getCell(`Q${currentRow}`), 0, { align: "right" });
    }

    dataCell(ws.getCell(`R${currentRow}`), order.shippingPrice, { fmt: "#,##0.00", align: "right" });

    // S = SUM(Q:R) across all product rows for this order
    const lastProdRow = currentRow + productRows.length - 1;
    ws.getCell(`S${currentRow}`).value = { formula: `SUM(Q${currentRow}:R${lastProdRow})` };

    const exRate = order.exchangeRate ?? 84;
    dataCell(ws.getCell(`T${currentRow}`), exRate, { fmt: "0.00", align: "right" });

    // U = S * T
    ws.getCell(`U${currentRow}`).value = { formula: `S${currentRow}*T${currentRow}` };

    // V = Balance
    if (order.status === "INITIATED") {
      dataCell(ws.getCell(`V${currentRow}`), balBefore, { fmt: "#,##0.00", align: "right" });
    } else if (currentRow === 3) {
      // First real order — reference opening balance row
      ws.getCell(`V${currentRow}`).value = { formula: `V2-S${currentRow}` };
    } else {
      ws.getCell(`V${currentRow}`).value = { formula: `V${currentRow - (productRows.length > 1 ? productRows.length : 1)}-S${currentRow}` };
    }

    if (order.paymentDate) {
      dataCell(ws.getCell(`W${currentRow}`), order.paymentDate, { fmt: "yyyy-mm-dd" });
    }
    if (order.grsNumber) {
      dataCell(ws.getCell(`X${currentRow}`), order.grsNumber);
    }
    if (order.dollarAmount) {
      dataCell(ws.getCell(`Y${currentRow}`), order.dollarAmount, { fmt: "#,##0.00", align: "right" });
    }

    dataCell(ws.getCell(`Z${currentRow}`), { formula: `U${currentRow}` }, { fmt: "#,##0.00" });

    ws.getRow(currentRow).height = 13.2;
    currentRow++;

    // Additional product rows (same order, no customer info repeated)
    for (let p = 1; p < productRows.length; p++) {
      const prod = productRows[p];
      dataCell(ws.getCell(`I${currentRow}`), srNo, { align: "center" });
      dataCell(ws.getCell(`J${currentRow}`), prod.genericName);
      dataCell(ws.getCell(`K${currentRow}`), prod.manufacturer);
      dataCell(ws.getCell(`L${currentRow}`), prod.brandName);
      dataCell(ws.getCell(`M${currentRow}`), prod.qty,      { align: "right" });
      dataCell(ws.getCell(`P${currentRow}`), prod.unitPrice, { fmt: "0.000", align: "right" });
      ws.getCell(`Q${currentRow}`).value = { formula: `P${currentRow}*M${currentRow}` };
      ws.getRow(currentRow).height = 13.2;
      currentRow++;
    }

    srNo++;
  }

  const array = await wb.xlsx.writeBuffer();
  return Buffer.from(array);
}