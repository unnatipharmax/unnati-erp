// src/app/api/packaging/invoice/route.ts
// POST — generate next invoice number + assign to order + set status to PACKING
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";
import { sendShipmentNotification } from "../../../../lib/email";

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

  const { orderId, trackingNo, licenseNo, netWeight, grossWeight } = await req.json();
  if (!orderId)
    return NextResponse.json({ error: "orderId required" }, { status: 400 });

  // Check order exists + is PAYMENT_VERIFIED (fetch all fields needed for email too)
  const order = await prisma.orderInitiation.findUnique({
    where: { id: orderId },
    select: {
      id: true, status: true, invoiceNo: true,
      fullName: true, email: true, country: true,
      accountId: true,         // null = individual client, non-null = bulk/account client
      orderEntry: {
        select: {
          shipmentMode: true,
          items: { select: { quantity: true, product: { select: { name: true } } } },
        },
      },
    },
  });

  if (!order)
    return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // If already has invoice, still update trackingNo/licenseNo and return existing
  if (order.invoiceNo) {
    if (trackingNo) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "OrderInitiation" SET "trackingNo" = $1 WHERE id = $2`,
          trackingNo, orderId
        );
      } catch { /* column may not exist yet */ }
    }
    if (licenseNo) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "OrderInitiation" SET "licenseNo" = $1 WHERE id = $2`,
          licenseNo, orderId
        );
      } catch { /* column may not exist yet */ }
    }
    if (netWeight != null) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "OrderInitiation" SET "netWeight" = $1 WHERE id = $2`,
          netWeight, orderId
        );
      } catch { /* column may not exist yet */ }
    }
    if (grossWeight != null) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "OrderInitiation" SET "grossWeight" = $1 WHERE id = $2`,
          grossWeight, orderId
        );
      } catch { /* column may not exist yet */ }
    }
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

  // Save trackingNo and licenseNo via raw SQL (columns added after initial prisma generate)
  if (trackingNo) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "OrderInitiation" SET "trackingNo" = $1 WHERE id = $2`,
        trackingNo, orderId
      );
    } catch { /* column may not exist yet */ }
  }
  if (licenseNo) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "OrderInitiation" SET "licenseNo" = $1 WHERE id = $2`,
        licenseNo, orderId
      );
    } catch { /* column may not exist yet */ }
  }
  if (netWeight != null) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "OrderInitiation" SET "netWeight" = $1 WHERE id = $2`,
        netWeight, orderId
      );
    } catch { /* column may not exist yet */ }
  }
  if (grossWeight != null) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "OrderInitiation" SET "grossWeight" = $1 WHERE id = $2`,
        grossWeight, orderId
      );
    } catch { /* column may not exist yet */ }
  }

  // ── Send tracking email — only for individual (non-bulk) clients ──────────
  // accountId !== null means it's a bulk/account client → skip email
  if (!order.accountId && trackingNo && order.email) {
    const products = order.orderEntry?.items.map(i => ({
      name: i.product.name,
      quantity: i.quantity,
    })) ?? [];

    // Fire-and-forget — don't block the response
    sendShipmentNotification({
      clientEmail:  order.email,
      clientName:   order.fullName,
      invoiceNo,
      trackingNo,
      shipmentMode: order.orderEntry?.shipmentMode ?? "EMS",
      country:      order.country,
      products,
    }).catch(err => console.error("[Invoice] Shipment email failed:", err));
  }

  return NextResponse.json({ invoiceNo, existing: false });
}