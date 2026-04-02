// POST /api/client-accounts/[id]/import-orders
// Accepts a multipart form with an .xlsx file, parses it, and bulk-creates OrderInitiation rows
import { NextResponse } from "next/server";
import { Prisma, OrderSource } from "@prisma/client";
import ExcelJS from "exceljs";
import { prisma } from "../../../../../lib/prisma";
import { getSession } from "../../../../../lib/auth";

export const runtime = "nodejs";

// ── Column aliases ─────────────────────────────────────────────────────────────
const ALIASES: Record<string, string> = {
  "full name": "fullName", "name": "fullName", "customer name": "fullName", "full name *": "fullName",
  "email": "email", "email *": "email",
  "phone": "phone", "mobile": "phone", "phone *": "phone",
  "address": "address", "address *": "address",
  "city": "city", "city *": "city",
  "state": "state", "province": "state", "state *": "state",
  "postal code": "postalCode", "pincode": "postalCode", "zip": "postalCode", "pin": "postalCode", "postal code *": "postalCode",
  "country": "country", "country *": "country",
  "amount paid": "amountPaid", "amount": "amountPaid",
  "currency": "currency",
  "remitter name": "remitterName", "remitter": "remitterName",
  "license no": "licenseNo", "licence no": "licenseNo", "drug license": "licenseNo", "license number": "licenseNo",
};

function normalizeKey(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "text" in (v as object)) return String((v as { text: string }).text);
  if (typeof v === "object" && "result" in (v as object)) return String((v as { result: unknown }).result);
  return String(v).trim();
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: accountId } = await params;

  // ── Validate account + get token ───────────────────────────────────────────
  const account = await prisma.clientAccount.findUnique({
    where: { id: accountId },
    include: { links: { where: { isActive: true }, take: 1 } },
  });
  if (!account || !account.isActive)
    return NextResponse.json({ error: "Account not found or inactive" }, { status: 404 });

  const token = account.links[0]?.token ?? null;

  // ── Parse uploaded file ────────────────────────────────────────────────────
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "No form data" }, { status: 400 });

  const file = form.get("file");
  if (!file || typeof file === "string")
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const arrayBuf = await (file as File).arrayBuffer();
  const buffer   = Buffer.from(arrayBuf);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.worksheets[0];
  if (!ws) return NextResponse.json({ error: "Workbook has no sheets" }, { status: 400 });

  // ── Build column-index → field map from header row ────────────────────────
  const headerRow = ws.getRow(1);
  const colMap: Record<number, string> = {};
  headerRow.eachCell((cell, colIdx) => {
    const key = normalizeKey(cell.value);
    const field = ALIASES[key];
    if (field) colMap[colIdx] = field;
  });

  // ── Parse each data row ────────────────────────────────────────────────────
  type RowData = Record<string, string>;
  const rows: RowData[] = [];
  ws.eachRow((row, rowIdx) => {
    if (rowIdx === 1) return; // skip header
    const obj: RowData = {};
    row.eachCell((cell, colIdx) => {
      const field = colMap[colIdx];
      if (field) obj[field] = cellText(cell);
    });
    // Skip completely empty rows
    const hasData = Object.values(obj).some(v => v !== "");
    if (hasData) rows.push(obj);
  });

  if (rows.length === 0)
    return NextResponse.json({ error: "No data rows found in the file" }, { status: 400 });

  // ── Validate & bulk-create ─────────────────────────────────────────────────
  const REQUIRED = ["fullName", "email", "phone", "address", "city", "state", "postalCode", "country"] as const;

  type ResultRow = { row: number; orderId?: string; error?: string };
  const results: ResultRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r   = rows[i];
    const rowNum = i + 2; // 1-indexed + header

    const missing = REQUIRED.filter(f => !r[f]?.trim());
    if (missing.length > 0) {
      results.push({ row: rowNum, error: `Missing: ${missing.join(", ")}` });
      continue;
    }

    try {
      const order = await prisma.orderInitiation.create({
        data: {
          source:          OrderSource.CLIENT,
          clientFormToken: token,
          accountId,
          fullName:        r.fullName.trim(),
          email:           r.email.trim(),
          phone:           r.phone.trim(),
          address:         r.address.trim(),
          city:            r.city.trim(),
          state:           r.state.trim(),
          postalCode:      r.postalCode.trim(),
          country:         r.country.trim(),
          remitterName:    r.remitterName?.trim() ?? "",
          licenseNo:       r.licenseNo?.trim() ?? null,
          amountPaid:      new Prisma.Decimal(r.amountPaid?.trim() || "0"),
          currency:        r.currency?.trim() || "INR",
        },
        select: { id: true },
      });
      results.push({ row: rowNum, orderId: order.id });
    } catch (e: unknown) {
      results.push({ row: rowNum, error: e instanceof Error ? e.message : "DB error" });
    }
  }

  const created = results.filter(r => r.orderId).length;
  const errors  = results.filter(r => r.error);

  return NextResponse.json({ created, total: rows.length, errors, results });
}
