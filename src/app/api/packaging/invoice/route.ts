// src/app/api/packaging/invoice/route.ts
// POST — generate next invoice number + assign to order + set status to PACKING
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

// Get current financial year key e.g. "2526" for Apr 2025 – Mar 2026
function getFinancialYear(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year  = now.getFullYear();
  // FY starts April (month 4)
  const fyStart = month >= 4 ? year     : year - 1;
  const fyEnd   = month >= 4 ? year + 1 : year;
  return `${String(fyStart).slice(-2)}${String(fyEnd).slice(-2)}`; // "2526"
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "PACKAGING"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { orderId } = await req.json();
  if (!orderId)
    return NextResponse.json({ error: "orderId required" }, { status: 400 });

  // Check order exists + is PAYMENT_VERIFIED
  const order = await prisma.orderInitiation.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, invoiceNo: true },
  });

  if (!order)
    return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // If already has invoice, return existing
  if (order.invoiceNo) {
    return NextResponse.json({ invoiceNo: order.invoiceNo, existing: true });
  }

  if (order.status !== "PAYMENT_VERIFIED")
    return NextResponse.json(
      { error: "Order must be PAYMENT_VERIFIED before generating invoice" },
      { status: 400 }
    );

  const fy = getFinancialYear();

  // Atomic: upsert sequence + increment in a transaction
  const invoiceNo = await prisma.$transaction(async (tx) => {
    const seq = await tx.invoiceSequence.upsert({
      where:  { financialYear: fy },
      create: { financialYear: fy, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    const num = seq.lastNumber.toString().padStart(3, "0");
    return `E-${fy}-${num}`; // e.g. E-2526-001
  });

  // Assign invoice + move to PACKING
  await prisma.orderInitiation.update({
    where: { id: orderId },
    data: {
      invoiceNo,
      invoiceGeneratedAt: new Date(),
      status: "PACKING",
    },
  });

  return NextResponse.json({ invoiceNo, existing: false });
}