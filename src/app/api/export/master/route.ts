import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";
import { prisma as db } from "../../../../lib/prisma";
import ExcelJS from "exceljs";

export async function GET() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Fetch all data in parallel ────────────────────────────────────────────
  const [
    orders,
    orderItems,
    products,
    purchaseBills,
    purchaseItems,
    clients,
    ledger,
    expenses,
    exportReturns,
    parties,
    partyPayments,
  ] = await Promise.all([
    db.orderInitiation.findMany({
      orderBy: { createdAt: "desc" },
      include: { orderEntry: true },
    }),
    db.orderEntryItem.findMany({
      include: {
        orderEntry: { include: { order: true } },
        product: { select: { name: true, hsn: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.product.findMany({ orderBy: { name: "asc" }, include: { group: true } }),
    db.purchaseBill.findMany({
      orderBy: { createdAt: "desc" },
      include: { party: { select: { name: true } } },
    }),
    db.purchaseItem.findMany({
      include: {
        product: { select: { name: true } },
        purchase: { select: { invoiceNo: true, party: { select: { name: true } } } },
      },
    }),
    db.clientAccount.findMany({ orderBy: { name: "asc" } }),
    db.accountLedger.findMany({
      orderBy: { createdAt: "desc" },
      include: { account: { select: { name: true } } },
    }),
    db.expense.findMany({ orderBy: { expenseDate: "desc" } }),
    db.exportReturn.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        originalOrder: { select: { invoiceNo: true, fullName: true } },
        items: true,
      },
    }),
    db.party.findMany({ orderBy: { name: "asc" } }),
    db.partyPayment.findMany({
      orderBy: { paymentDate: "desc" },
      include: { party: { select: { name: true } } },
    }),
  ]);

  // ── Build workbook ────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = "Unnati Pharmax ERP";
  wb.created = new Date();

  const HEADER_FILL: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1A3A6B" },
  };
  const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  const ALT_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F7FB" } };

  function styleSheet(ws: ExcelJS.Worksheet, headers: string[]) {
    const headerRow = ws.getRow(1);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: "FFC8960C" } } };
    });
    headerRow.height = 22;
    ws.autoFilter = { from: "A1", to: { row: 1, column: headers.length } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }

  function altRows(ws: ExcelJS.Worksheet, startRow: number, count: number) {
    for (let r = startRow; r < startRow + count; r++) {
      if (r % 2 === 0) {
        ws.getRow(r).eachCell(c => { c.fill = ALT_FILL; });
      }
    }
  }

  function fmtDate(d: Date | string | null | undefined): string {
    if (!d) return "";
    const dt = typeof d === "string" ? new Date(d) : d;
    return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-IN");
  }

  function num(v: unknown): number {
    if (v == null) return 0;
    return typeof v === "object" ? parseFloat(String(v)) : Number(v);
  }

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Summary");
    ws.mergeCells("A1:B1");
    ws.getCell("A1").value = "UNNATI PHARMAX — ERP Data Export";
    ws.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF7A5C00" } };
    ws.getCell("A1").alignment = { horizontal: "center" };
    ws.getRow(1).height = 28;

    ws.mergeCells("A2:B2");
    ws.getCell("A2").value = `Generated: ${new Date().toLocaleString("en-IN")}`;
    ws.getCell("A2").font = { italic: true, color: { argb: "FF555555" } };

    const summaryData = [
      ["", ""],
      ["Section", "Count"],
      ["Orders (Total)", orders.length],
      ["Orders (Dispatched)", orders.filter(o => o.status === "DISPATCHED").length],
      ["Products", products.length],
      ["Clients (Accounts)", clients.length],
      ["Purchase Bills", purchaseBills.length],
      ["Suppliers (Parties)", parties.length],
      ["Expenses", expenses.length],
      ["Export Returns", exportReturns.length],
      ["Ledger Entries", ledger.length],
    ];

    summaryData.forEach((row, i) => {
      const r = ws.addRow(row);
      if (i === 1) {
        r.font = { bold: true };
        r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
        r.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
      }
    });

    ws.getColumn(1).width = 30;
    ws.getColumn(2).width = 16;
  }

  // ── Sheet 2: Orders ───────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Orders");
    const headers = [
      "Invoice No", "Order Date", "Invoice Date", "Customer Name",
      "Country", "Currency", "Amount Paid (USD)", "INR Amount",
      "Exchange Rate", "Shipment Mode", "Shipping Price (INR)",
      "Tracking No", "Status", "Remitter", "License No",
      "Address", "City", "State", "Postal Code", "Email",
    ];
    styleSheet(ws, headers);

    const startRow = 2;
    orders.forEach((o, idx) => {
      ws.addRow([
        o.invoiceNo ?? "",
        fmtDate(o.createdAt),
        fmtDate(o.invoiceGeneratedAt),
        o.fullName,
        o.country,
        o.currency,
        num(o.amountPaid),
        num(o.inrAmount),
        num(o.exchangeRate),
        o.orderEntry?.shipmentMode ?? "",
        num(o.orderEntry?.shippingPrice),
        o.trackingNo ?? "",
        o.status,
        o.remitterName,
        o.licenseNo ?? "",
        o.address,
        o.city,
        o.state,
        o.postalCode,
        o.email,
      ]);
    });
    altRows(ws, startRow, orders.length);

    ws.getColumn(1).width = 16;
    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 14;
    ws.getColumn(4).width = 24;
    ws.getColumn(5).width = 16;
    [7, 8, 9, 11].forEach(c => { ws.getColumn(c).numFmt = "#,##0.00"; ws.getColumn(c).width = 16; });
  }

  // ── Sheet 3: Order Items ──────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Order Items");
    const headers = [
      "Invoice No", "Customer", "Country", "Product", "HSN",
      "Qty", "Selling Price (USD)", "Line Total (USD)",
      "Shipment Mode", "Order Date",
    ];
    styleSheet(ws, headers);

    const startRow = 2;
    orderItems.forEach(item => {
      const order = item.orderEntry.order;
      const qty   = item.quantity;
      const price = num(item.sellingPrice);
      ws.addRow([
        order.invoiceNo ?? "",
        order.fullName,
        order.country,
        item.product.name,
        item.product.hsn ?? "",
        qty,
        price,
        +(qty * price).toFixed(2),
        item.orderEntry.order.status,
        fmtDate(item.createdAt),
      ]);
    });
    altRows(ws, startRow, orderItems.length);
    [4, 10].forEach(c => { ws.getColumn(c).width = 14; });
    ws.getColumn(1).width = 16; ws.getColumn(2).width = 24;
    ws.getColumn(4).width = 28; ws.getColumn(6).width = 8;
    [7, 8].forEach(c => { ws.getColumn(c).numFmt = "#,##0.00"; ws.getColumn(c).width = 18; });
  }

  // ── Sheet 4: Products ─────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Products");
    const headers = [
      "Name", "Group", "Manufacturer", "Composition",
      "HSN", "Pack", "MRP", "GST %",
      "Batch No", "Mfg Date", "Exp Date",
      "Min Margin %", "Max Margin %", "Unit Type", "Unit Weight (kg)",
      "Qty per Pack", "Active",
    ];
    styleSheet(ws, headers);
    const startRow = 2;
    products.forEach(p => {
      ws.addRow([
        p.name, p.group?.name ?? "", p.manufacturer ?? "",
        p.composition ?? "", p.hsn ?? "", p.pack ?? "",
        p.mrp ?? "", p.gstPercent ?? "",
        p.batchNo ?? "", p.mfgDate ?? "", p.expDate ?? "",
        p.minMargin ?? "", p.maxMargin ?? "",
        p.unitType ?? "", p.unitWeightKg ?? "",
        p.qty ?? "", p.isActive ? "Yes" : "No",
      ]);
    });
    altRows(ws, startRow, products.length);
    ws.getColumn(1).width = 30; ws.getColumn(2).width = 18;
    ws.getColumn(3).width = 22; ws.getColumn(4).width = 30;
  }

  // ── Sheet 5: Purchase Bills ───────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Purchase Bills");
    const headers = [
      "Bill No", "Bill Date", "Supplier", "Document Type", "Total Amount (INR)", "Created At",
    ];
    styleSheet(ws, headers);
    const startRow = 2;
    purchaseBills.forEach(b => {
      ws.addRow([
        b.invoiceNo ?? "",
        fmtDate(b.invoiceDate),
        b.party.name,
        b.documentType,
        b.totalAmount ?? 0,
        fmtDate(b.createdAt),
      ]);
    });
    altRows(ws, startRow, purchaseBills.length);
    ws.getColumn(1).width = 18; ws.getColumn(3).width = 26;
    ws.getColumn(5).numFmt = "#,##0.00"; ws.getColumn(5).width = 18;
  }

  // ── Sheet 6: Purchase Items ───────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Purchase Items");
    const headers = [
      "Bill No", "Supplier", "Product", "Batch", "Expiry",
      "Qty", "Rate (INR)", "Discount", "GST %",
      "Taxable Amt", "CGST", "SGST", "IGST", "MRP",
    ];
    styleSheet(ws, headers);
    const startRow = 2;
    purchaseItems.forEach(item => {
      ws.addRow([
        item.purchase.invoiceNo ?? "",
        item.purchase.party.name,
        item.product.name,
        item.batch ?? "",
        item.expiry ?? "",
        item.quantity,
        item.rate,
        item.discount ?? 0,
        item.gstPercent ?? 0,
        item.taxableAmount ?? 0,
        item.cgstAmount ?? 0,
        item.sgstAmount ?? 0,
        item.igstAmount ?? 0,
        item.mrp ?? 0,
      ]);
    });
    altRows(ws, startRow, purchaseItems.length);
    ws.getColumn(3).width = 28;
    [7, 8, 10, 11, 12, 13, 14].forEach(c => {
      ws.getColumn(c).numFmt = "#,##0.00"; ws.getColumn(c).width = 14;
    });
  }

  // ── Sheet 7: Clients ──────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Clients");
    const headers = [
      "Name", "Balance (INR)", "Address", "GST No",
      "Drug License No", "Notes", "Active", "Created At",
    ];
    styleSheet(ws, headers);
    const startRow = 2;
    clients.forEach(c => {
      ws.addRow([
        c.name, num(c.balance), c.address ?? "",
        c.gstNumber ?? "", c.drugLicenseNumber ?? "",
        c.notes ?? "", c.isActive ? "Yes" : "No", fmtDate(c.createdAt),
      ]);
    });
    altRows(ws, startRow, clients.length);
    ws.getColumn(1).width = 26; ws.getColumn(2).numFmt = "#,##0.00"; ws.getColumn(2).width = 16;
    ws.getColumn(3).width = 30;
  }

  // ── Sheet 8: Ledger ───────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Ledger");
    const headers = ["Client", "Type", "Amount (INR)", "Note", "Order/Ref", "Date"];
    styleSheet(ws, headers);
    const startRow = 2;
    ledger.forEach(e => {
      ws.addRow([
        e.account.name, e.type, num(e.amount),
        e.note ?? "", e.orderId ?? "", fmtDate(e.createdAt),
      ]);
    });
    altRows(ws, startRow, ledger.length);
    ws.getColumn(1).width = 26; ws.getColumn(3).numFmt = "#,##0.00"; ws.getColumn(3).width = 16;
    ws.getColumn(4).width = 30; ws.getColumn(6).width = 14;
  }

  // ── Sheet 9: Expenses ─────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Expenses");
    const headers = ["Category", "Description", "Amount (INR)", "Date", "Payment Mode", "Notes"];
    styleSheet(ws, headers);
    const startRow = 2;
    expenses.forEach(e => {
      ws.addRow([
        e.category, e.description, e.amount,
        fmtDate(e.expenseDate), e.paymentMode ?? "", e.notes ?? "",
      ]);
    });
    altRows(ws, startRow, expenses.length);
    ws.getColumn(1).width = 18; ws.getColumn(2).width = 30;
    ws.getColumn(3).numFmt = "#,##0.00"; ws.getColumn(3).width = 16;
    ws.getColumn(4).width = 14;
  }

  // ── Sheet 10: Suppliers ───────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Suppliers");
    const headers = ["Name", "Address", "GST No", "Drug License No", "Notes", "Active"];
    styleSheet(ws, headers);
    const startRow = 2;
    parties.forEach(p => {
      ws.addRow([
        p.name, p.address ?? "", p.gstNumber ?? "",
        p.drugLicenseNumber ?? "", p.notes ?? "", p.isActive ? "Yes" : "No",
      ]);
    });
    altRows(ws, startRow, parties.length);
    ws.getColumn(1).width = 26; ws.getColumn(2).width = 30;
  }

  // ── Sheet 11: Party Payments ──────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Supplier Payments");
    const headers = ["Supplier", "Amount (INR)", "Date", "Mode", "Reference", "Notes"];
    styleSheet(ws, headers);
    const startRow = 2;
    partyPayments.forEach(p => {
      ws.addRow([
        p.party.name, p.amount, fmtDate(p.paymentDate),
        p.mode ?? "", p.reference ?? "", p.notes ?? "",
      ]);
    });
    altRows(ws, startRow, partyPayments.length);
    ws.getColumn(1).width = 26; ws.getColumn(2).numFmt = "#,##0.00"; ws.getColumn(2).width = 16;
  }

  // ── Sheet 12: Export Returns ──────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Export Returns");
    const headers = [
      "Original Invoice", "Customer", "Return Type", "Return Date",
      "Reason", "Tracking Returned", "New Invoice", "New Shipping Cost",
      "New Shipping Mode", "Notes",
    ];
    styleSheet(ws, headers);
    const startRow = 2;
    exportReturns.forEach(r => {
      ws.addRow([
        r.originalOrder.invoiceNo ?? "",
        r.originalOrder.fullName,
        r.returnType,
        fmtDate(r.returnDate),
        r.reason ?? "",
        r.trackingReturned ?? "",
        r.newInvoiceNo ?? "",
        num(r.newShippingCost),
        r.newShippingMode ?? "",
        r.notes ?? "",
      ]);
    });
    altRows(ws, startRow, exportReturns.length);
    ws.getColumn(1).width = 18; ws.getColumn(2).width = 24;
    ws.getColumn(8).numFmt = "#,##0.00";
  }

  // ── Stream response ───────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const fileName = `UnnatiPharmax_MasterData_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
