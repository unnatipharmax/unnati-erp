import ExcelJS from "exceljs";

const C = {
  orange: "FFFF9900",  // A, I-W
  amber:  "FFE69138",  // B-H
  green:  "FF00FF00",  // tracking cell bg
};

const thin = {
  top: { style: "thin" as const }, bottom: { style: "thin" as const },
  left: { style: "thin" as const }, right:  { style: "thin" as const },
};

function hdr(cell: ExcelJS.Cell, text: string, bg: string) {
  cell.value     = text;
  cell.font      = { name: "Arial", size: 10, bold: true };
  cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
  cell.alignment = { horizontal: "left", vertical: "middle" };
  cell.border    = thin;
}

function dat(cell: ExcelJS.Cell, value: ExcelJS.CellValue, opts: { fmt?: string; bg?: string; align?: ExcelJS.Alignment["horizontal"] } = {}) {
  cell.value     = value;
  cell.font      = { name: "Arial", size: 10 };
  cell.alignment = { horizontal: opts.align ?? "left", vertical: "middle" };
  cell.border    = thin;
  if (opts.fmt) cell.numFmt = opts.fmt;
  if (opts.bg)  cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: opts.bg } };
}

export type OrderRow = {
  orderId:       string;
  fullName:      string;
  address:       string;
  city:          string;
  state:         string;
  postalCode:    string;
  country:       string;
  trackingNo?:   string | null;
  brandName:     string;           // product brand names joined
  quantity:      number;
  shipmentMode:  string;
  notes?:        string | null;
  unitPrice:     number;
  shippingPrice: number;
  exchangeRate?: number;
  orderValue:    number;
  balanceBefore: number;
  balanceAfter:  number;
  status:        string;
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
  const { openingBalance, orders } = params;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Unnati Pharmax ERP";
  wb.created = new Date();

  const ws = wb.addWorksheet("Sheet1");
  ws.properties.defaultRowHeight = 13.2;
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // ── Column definitions exactly matching template ──────────────────────────
  const cols = [
    { col: "A", header: "Order Id",              bg: C.orange, width: 13.0  },
    { col: "B", header: "CUSTOMER NAME",          bg: C.amber,  width: 15.88 },
    { col: "C", header: "SHIPPING ADDRESS",       bg: C.amber,  width: 17.63 },
    { col: "D", header: "CITY",                   bg: C.amber,  width: 13.0  },
    { col: "E", header: "STATE",                  bg: C.amber,  width: 13.0  },
    { col: "F", header: "POST CODE ZIP",          bg: C.amber,  width: 13.88 },
    { col: "G", header: "COUNTRY",                bg: C.amber,  width: 13.0  },
    { col: "H", header: "TRACKING",               bg: C.amber,  width: 13.0  },
    { col: "I", header: "BRAND NAME",             bg: C.orange, width: 13.0  },
    { col: "J", header: "Quantity",               bg: C.orange, width: 13.0  },
    { col: "K", header: "Shipping Service",       bg: C.orange, width: 20.5  },
    { col: "L", header: "Comments if Any",        bg: C.orange, width: 13.0  },
    { col: "M", header: "PRICE ( UNIT )",         bg: C.orange, width: 13.0  },
    { col: "N", header: "TOTAL",                  bg: C.orange, width: 13.0  },
    { col: "O", header: "SHIPPING",               bg: C.orange, width: 13.0  },
    { col: "P", header: "Total",                  bg: C.orange, width: 13.0  },
    { col: "Q", header: "Exchange Rate",          bg: C.orange, width: 13.0  },
    { col: "R", header: "INR AMOUNT",             bg: C.orange, width: 13.0  },
    { col: "S", header: "BALANCE",                bg: C.orange, width: 13.0  },
    { col: "T", header: "Payment Deposite Date",  bg: C.orange, width: 13.0  },
    { col: "U", header: "GRS NUMBER",             bg: C.orange, width: 13.0  },
    { col: "V", header: "DOLLAR AMOUNT",          bg: C.orange, width: 13.0  },
    { col: "W", header: "INR AMOUNT",             bg: C.orange, width: 13.0  },
  ];

  // Set widths + write headers
  cols.forEach(({ col, header, bg, width }) => {
    ws.getColumn(col).width = width;
    hdr(ws.getCell(`${col}1`), header, bg);
  });
  ws.getRow(1).height = 13.2;

  // ── Opening balance row ───────────────────────────────────────────────────
  let row = 2;
  dat(ws.getCell(`A${row}`), "Opening Balance");
  dat(ws.getCell(`S${row}`), openingBalance, { fmt: "#,##0.00", align: "right" });
  ws.getRow(row).height = 13.2;
  row++;

  // ── Order rows ────────────────────────────────────────────────────────────
  let srNo    = 1;
  let prevRow = 2; // track previous balance row

  for (const o of orders) {
    const exRate     = o.exchangeRate ?? 84;
    const isInitiated = o.status === "INITIATED";

    // A — Order ref
    dat(ws.getCell(`A${row}`), `RF${String(srNo).padStart(3, "0")}`);

    // B-G — Customer
    dat(ws.getCell(`B${row}`), o.fullName,   { bg: "FFFFFFFF" });
    dat(ws.getCell(`C${row}`), o.address,    { bg: "FFFFFFFF" });
    dat(ws.getCell(`D${row}`), o.city,       { bg: "FFFFFFFF" });
    dat(ws.getCell(`E${row}`), o.state,      { bg: "FFFFFFFF" });
    dat(ws.getCell(`F${row}`), o.postalCode, { bg: "FFFFFFFF" });
    dat(ws.getCell(`G${row}`), o.country);

    // H — Tracking (green bg if present)
    if (o.trackingNo) {
      dat(ws.getCell(`H${row}`), o.trackingNo, { bg: C.green });
    } else {
      dat(ws.getCell(`H${row}`), "");
    }

    // I-L — Product info
    dat(ws.getCell(`I${row}`), isInitiated ? "Pending entry" : o.brandName);
    dat(ws.getCell(`J${row}`), isInitiated ? 0 : o.quantity,   { align: "right" });
    dat(ws.getCell(`K${row}`), o.shipmentMode);
    dat(ws.getCell(`L${row}`), o.notes ?? "");

    // M — Unit price
    dat(ws.getCell(`M${row}`), isInitiated ? 0 : o.unitPrice, { fmt: "0.000", align: "right" });

    // N = M * J  (Total before shipping)
    if (!isInitiated && o.quantity > 0) {
      ws.getCell(`N${row}`).value = { formula: `M${row}*J${row}` };
    } else {
      dat(ws.getCell(`N${row}`), 0, { align: "right" });
    }
    ws.getCell(`N${row}`).font      = { name: "Arial", size: 10 };
    ws.getCell(`N${row}`).border    = thin;
    ws.getCell(`N${row}`).alignment = { horizontal: "right" };

    // O — Shipping
    dat(ws.getCell(`O${row}`), isInitiated ? 0 : o.shippingPrice, { fmt: "#,##0.00", align: "right" });

    // P = N + O  (Grand total)
    ws.getCell(`P${row}`).value     = { formula: `N${row}+O${row}` };
    ws.getCell(`P${row}`).font      = { name: "Arial", size: 10 };
    ws.getCell(`P${row}`).border    = thin;
    ws.getCell(`P${row}`).alignment = { horizontal: "right" };
    ws.getCell(`P${row}`).numFmt    = "#,##0.00";

    // Q — Exchange Rate
    dat(ws.getCell(`Q${row}`), exRate, { fmt: "0.00", align: "right" });

    // R = P * Q  (INR Amount)
    ws.getCell(`R${row}`).value     = { formula: `P${row}*Q${row}` };
    ws.getCell(`R${row}`).font      = { name: "Arial", size: 10 };
    ws.getCell(`R${row}`).border    = thin;
    ws.getCell(`R${row}`).alignment = { horizontal: "right" };
    ws.getCell(`R${row}`).numFmt    = "#,##0.00";

    // S — Balance
    if (isInitiated) {
      dat(ws.getCell(`S${row}`), o.balanceBefore, { fmt: "#,##0.00", align: "right" });
    } else {
      ws.getCell(`S${row}`).value     = { formula: `S${prevRow}-P${row}` };
      ws.getCell(`S${row}`).font      = { name: "Arial", size: 10 };
      ws.getCell(`S${row}`).border    = thin;
      ws.getCell(`S${row}`).alignment = { horizontal: "right" };
      ws.getCell(`S${row}`).numFmt    = "#,##0.00";
      prevRow = row;
    }

    // T — Payment date
    if (o.paymentDate) dat(ws.getCell(`T${row}`), o.paymentDate, { fmt: "yyyy-mm-dd" });
    else               dat(ws.getCell(`T${row}`), "");

    // U — GRS Number
    dat(ws.getCell(`U${row}`), o.grsNumber ?? "");

    // V — Dollar Amount
    if (o.dollarAmount) dat(ws.getCell(`V${row}`), o.dollarAmount, { fmt: "#,##0.00", align: "right" });
    else                dat(ws.getCell(`V${row}`), "");

    // W = R (INR Amount duplicate)
    ws.getCell(`W${row}`).value     = { formula: `R${row}` };
    ws.getCell(`W${row}`).font      = { name: "Arial", size: 10 };
    ws.getCell(`W${row}`).border    = thin;
    ws.getCell(`W${row}`).alignment = { horizontal: "right" };
    ws.getCell(`W${row}`).numFmt    = "#,##0.00";

    ws.getRow(row).height = 13.2;
    srNo++;
    row++;
  }

  const array = await wb.xlsx.writeBuffer();
  return Buffer.from(array);
}