// src/app/api/expenses/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

// DELETE expense
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "Expense" WHERE id = $1`, id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

// PATCH — update expense
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { description, amount, expenseDate, paymentMode, notes } = await req.json();

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "Expense" SET "description"=$1,"amount"=$2,"expenseDate"=$3,"paymentMode"=$4,"notes"=$5 WHERE id=$6`,
      description, Number(amount),
      expenseDate ? new Date(expenseDate) : new Date(),
      paymentMode || null, notes || null, id
    );
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
