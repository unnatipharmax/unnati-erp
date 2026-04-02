// GET /api/client-accounts/template
// Returns an Excel (.xlsx) file with the required column headers for bulk order import
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

export async function GET() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Orders");

  ws.columns = [
    { header: "Full Name *",    key: "fullName",      width: 22 },
    { header: "Email *",        key: "email",         width: 28 },
    { header: "Phone *",        key: "phone",         width: 16 },
    { header: "Address *",      key: "address",       width: 30 },
    { header: "City *",         key: "city",          width: 16 },
    { header: "State *",        key: "state",         width: 16 },
    { header: "Postal Code *",  key: "postalCode",    width: 14 },
    { header: "Country *",      key: "country",       width: 14 },
    { header: "Amount Paid",    key: "amountPaid",    width: 14 },
    { header: "Currency",       key: "currency",      width: 10 },
    { header: "Remitter Name",  key: "remitterName",  width: 22 },
    { header: "License No",     key: "licenseNo",     width: 18 },
  ];

  // Style header row
  ws.getRow(1).eachCell(cell => {
    cell.font      = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border    = {
      bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
    };
  });

  // Sample row
  ws.addRow({
    fullName:     "John Doe",
    email:        "john@example.com",
    phone:        "+91 9876543210",
    address:      "123 Main Street",
    city:         "Mumbai",
    state:        "Maharashtra",
    postalCode:   "400001",
    country:      "India",
    amountPaid:   5000,
    currency:     "INR",
    remitterName: "Jane Doe",
    licenseNo:    "DL-MH-12345",
  });

  const buf = await wb.xlsx.writeBuffer();

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="order-import-template.xlsx"',
    },
  });
}
