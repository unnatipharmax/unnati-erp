// POST — generate one combined invoice number for multiple orders (same day batch)
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";
import { getActiveCompanyId } from "../../../../lib/company";

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
  const companyId = await getActiveCompanyId();

  // Verify all orders belong to the active company + are PAYMENT_VERIFIED + uninvoiced
  const dbOrders = await prisma.orderInitiation.findMany({
    where: { id: { in: orderIds }, companyId },
    select: { id: true, status: true, invoiceNo: true, currency: true, grsNumber: true },
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

  // ── Combinability guards (mirror of the packaging UI rules) ────────────────
  // 1. Only same payment category: GRS (grsNumber contains "GRS") vs Non-GRS.
  // 2. Only same currency.
  if (dbOrders.length > 1) {
    const categories = new Set(
      dbOrders.map((o) => ((o.grsNumber ?? "").toUpperCase().includes("GRS") ? "GRS" : "NON_GRS"))
    );
    if (categories.size > 1)
      return NextResponse.json(
        { error: "Cannot combine GRS and Non-GRS orders together." },
        { status: 400 }
      );

    const currencies = new Set(dbOrders.map((o) => (o.currency || "").toUpperCase()));
    if (currencies.size > 1)
      return NextResponse.json(
        { error: `Cannot combine orders with different currencies (${[...currencies].join(", ")}).` },
        { status: 400 }
      );
  }

  const fy = getFinancialYear();
  const co = await prisma.companySetting.findUnique({ where: { id: companyId }, select: { invoicePrefix: true } });
  const prefix = (co?.invoicePrefix || "E").trim() || "E";

  // Generate ONE invoice number for all selected orders (atomic, scoped to company)
  const invoiceNo = await prisma.$transaction(async (tx) => {
    const seq = await tx.invoiceSequence.upsert({
      where: { companyId_financialYear: { companyId, financialYear: fy } },
      create: { companyId, financialYear: fy, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    const num = seq.lastNumber.toString().padStart(3, "0");
    return `${prefix}-${fy}-${num}`;
  });

  // Assign the same invoice number to all orders + move them to PACKING
  await prisma.orderInitiation.updateMany({
    where: { id: { in: orderIds }, companyId },
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
