// src/app/api/expenses/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/auth";

export const runtime = "nodejs";

// GET — list expenses, optional ?category=PERSONAL&year=2026&month=3
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category"); // PERSONAL | STATIONARY | MONTHLY | YEARLY
  const year     = searchParams.get("year");
  const month    = searchParams.get("month");

  let where = `WHERE 1=1`;
  const args: (string | number)[] = [];
  let idx = 1;

  if (category) { where += ` AND "category" = $${idx++}`; args.push(category); }
  if (year)     { where += ` AND EXTRACT(YEAR  FROM "expenseDate") = $${idx++}`; args.push(Number(year)); }
  if (month)    { where += ` AND EXTRACT(MONTH FROM "expenseDate") = $${idx++}`; args.push(Number(month)); }

  try {
    const rows = await prisma.$queryRawUnsafe<{
      id: string; category: string; description: string;
      amount: number; expenseDate: Date; paymentMode: string | null;
      notes: string | null; createdAt: Date;
      vendorName: string | null; vendorGstin: string | null; billNo: string | null;
      taxableAmount: number | null; gstPercent: number | null; gstAmount: number | null;
      itcEligible: boolean | null;
    }[]>(
      `SELECT * FROM "Expense" ${where} ORDER BY "expenseDate" DESC, "createdAt" DESC`,
      ...args
    );
    return NextResponse.json({ expenses: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

// POST — create expense
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const {
    category, description, amount, expenseDate, paymentMode, notes,
    vendorName, vendorGstin, billNo, gstPercent, gstAmount, taxableAmount, itcEligible,
  } = await req.json();

  if (!category || !description || !amount)
    return NextResponse.json({ error: "category, description and amount are required" }, { status: 400 });

  const id = crypto.randomUUID();
  const date = expenseDate ? new Date(expenseDate) : new Date();

  // Derive GST split from gross amount + gstPercent when not explicitly provided.
  const gross = Number(amount);
  const pct = gstPercent != null && gstPercent !== "" ? Number(gstPercent) : null;
  let taxable = taxableAmount != null && taxableAmount !== "" ? Number(taxableAmount) : null;
  let gst = gstAmount != null && gstAmount !== "" ? Number(gstAmount) : null;
  if (pct != null && pct > 0 && gst == null) {
    // gross = taxable * (1 + pct/100) → taxable = gross / (1+pct/100)
    taxable = Math.round((gross / (1 + pct / 100)) * 100) / 100;
    gst = Math.round((gross - taxable) * 100) / 100;
  }

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Expense"
        ("id","category","description","amount","expenseDate","paymentMode","notes",
         "vendorName","vendorGstin","billNo","taxableAmount","gstPercent","gstAmount","itcEligible","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())`,
      id, category, description, gross, date,
      paymentMode || null, notes || null,
      vendorName || null, vendorGstin || null, billNo || null,
      taxable, pct, gst, Boolean(itcEligible)
    );
    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
