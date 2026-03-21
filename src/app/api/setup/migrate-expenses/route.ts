// src/app/api/setup/migrate-expenses/route.ts
// ONE-TIME — run once then delete this file
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Expense" (
        "id"          TEXT        NOT NULL,
        "category"    TEXT        NOT NULL,
        "description" TEXT        NOT NULL,
        "amount"      DOUBLE PRECISION NOT NULL,
        "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "paymentMode" TEXT,
        "notes"       TEXT,
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Expense_category_idx" ON "Expense"("category")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Expense_expenseDate_idx" ON "Expense"("expenseDate")`);

    return NextResponse.json({ success: true, message: "Expense table created. Delete this file now." });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Migration failed" }, { status: 500 });
  }
}
