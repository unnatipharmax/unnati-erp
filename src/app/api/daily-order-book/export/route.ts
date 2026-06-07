// POST /api/daily-order-book/export
// Body: { date: "YYYY-MM-DD", rows: BookingRow[] }
// Produces the postal "Daily Order Book" .xlsx with the exact 29-column layout.
import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

// Exact header order from the reference Booking Order Sheet (29 columns).
const HEADERS = [
  "SERVICE MODE ", "DATE ", "SL", "Name", "ADD1", "City", "State", "Pincode",
  "", "", "Addr Mobile", "Addr Email", "Sender Mobile", "Barcode", "Weight", "REF",
  "Country", "", "", "Document No", "Non Delivery Instruction", "Redirect Address",
  "Return or Redirect", "Required Service", "Article Content 1", "Article Value 1",
  "HS Tariff 1", "Article Quantity 1", "Article Weight 1",
];

type BookingRow = {
  serviceMode: string; date: string; name: string; add1: string; city: string;
  state: string; pincode: string; addrMobile: string; addrEmail: string;
  barcode: string; weight: string; ref: string; country: string;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "PACKAGING", "ACCOUNTS"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { date, rows }: { date?: string; rows?: BookingRow[] } = await req.json();
  const list = Array.isArray(rows) ? rows : [];

  const wb = new ExcelJS.Workbook();
  wb.creator = "Unnati Pharmax ERP";
  wb.created = new Date();
  const ws = wb.addWorksheet("Daily Order Book");

  // Header row
  const headerRow = ws.getRow(1);
  HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  headerRow.height = 20;

  // Reasonable column widths
  const widths = [12, 12, 5, 20, 36, 14, 18, 10, 6, 6, 12, 16, 12, 16, 9, 8, 16, 6, 6, 12, 18, 16, 14, 14, 16, 12, 10, 12, 12];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Data rows — populate only the mapped columns; rest stay blank like the template
  list.forEach((r, idx) => {
    const row = ws.getRow(idx + 2);
    row.getCell(1).value = r.serviceMode;                 // SERVICE MODE
    row.getCell(2).value = date || r.date;                // DATE
    row.getCell(3).value = idx + 1;                       // SL
    row.getCell(4).value = r.name;                        // Name
    row.getCell(5).value = r.add1;                        // ADD1
    row.getCell(5).alignment = { wrapText: true, vertical: "top" };
    row.getCell(6).value = r.city;                        // City
    row.getCell(7).value = r.state;                       // State
    row.getCell(8).value = r.pincode;                     // Pincode
    row.getCell(11).value = r.addrMobile;                 // Addr Mobile
    row.getCell(12).value = r.addrEmail;                  // Addr Email
    row.getCell(14).value = r.barcode;                    // Barcode (tracking)
    row.getCell(15).value = r.weight;                     // Weight (grams)
    row.getCell(16).value = r.ref;                        // REF (value)
    row.getCell(17).value = r.country;                    // Country
  });

  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buf = await wb.xlsx.writeBuffer();
  const fname = `Booking Order Sheet ${date || new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
