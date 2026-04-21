// POST — generate one combined invoice number for multiple orders (same day batch)
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

function getFinancialYear(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = month >= 4 ? year + 1 : year;
  return `${String(fyStart).slice(-2)}${String(fyEnd).slice(-2)}`;
}

type OrderPayload = {
  id: string;
  trackingNo?: string | null;
  licenseNo?: string | null;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "PACKAGING"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Accept array of { id, trackingNo?, licenseNo? } objects
  const { orders: orderPayloads }: { orders: OrderPayload[] } = await req.json();
  if (!Array.isArray(orderPayloads) || orderPayloads.length === 0)
    return NextResponse.json({ error: "orders array required" }, { status: 400 });

  const orderIds = orderPayloads.map((o) => o.id);

  // Verify all orders are PAYMENT_VERIFIED and don't already have an invoice
  const dbOrders = await prisma.orderInitiation.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, status: true, invoiceNo: true },
  });

  const alreadyInvoiced = dbOrders.filter((o) => !!o.invoiceNo);
  if (alreadyInvoiced.length > 0)
    return NextResponse.json(
      { error: `${alreadyInvoiced.length} order(s) already have an invoice` },
      { status: 400 }
    );

  const notVerified = dbOrders.filter((o) => o.status !== "PAYMENT_VERIFIED");
  if (notVerified.length > 0)
    return NextResponse.json(
      { error: `${notVerified.length} order(s) are not PAYMENT_VERIFIED` },
      { status: 400 }
    );

  const fy = getFinancialYear();

  // Generate ONE invoice number for all selected orders (atomic sequence increment)
  const invoiceNo = await prisma.$transaction(async (tx) => {
    const seq = await tx.invoiceSequence.upsert({
      where: { financialYear: fy },
      create: { financialYear: fy, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    const num = seq.lastNumber.toString().padStart(3, "0");
    return `E-${fy}-${num}`;
  });

  // Assign the same invoice number to all orders + move them to PACKING
  await prisma.orderInitiation.updateMany({
    where: { id: { in: orderIds } },
    data: {
      invoiceNo,
      invoiceGeneratedAt: new Date(),
      status: "PACKING",
    },
  });

  // Save per-order trackingNo and licenseNo via raw SQL
  for (const payload of orderPayloads) {
    if (payload.trackingNo) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "OrderInitiation" SET "trackingNo" = $1 WHERE id = $2`,
          payload.trackingNo,
          payload.id
        );
      } catch { /* column may not exist */ }
    }
    if (payload.licenseNo) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "OrderInitiation" SET "licenseNo" = $1 WHERE id = $2`,
          payload.licenseNo,
          payload.id
        );
      } catch { /* column may not exist */ }
    }
  }

  return NextResponse.json({ invoiceNo, orderCount: orderIds.length });
}
