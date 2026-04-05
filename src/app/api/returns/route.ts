// GET  /api/returns  — list all returned export entries
// POST /api/returns  — record a new return (REORDER or STOCK_RETURN)

import { NextResponse } from "next/server";
import { prisma }       from "../../../lib/prisma";
import { getSession }   from "../../../lib/auth";

export const runtime = "nodejs";

// ── financial year helper (same as packaging invoice) ─────────────────────────
function getFinancialYear(): string {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd   = month >= 4 ? year + 1 : year;
  return `${String(fyStart).slice(-2)}${String(fyEnd).slice(-2)}`;
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";

  const returns = await prisma.exportReturn.findMany({
    orderBy: { createdAt: "desc" },
    where: search ? {
      OR: [
        { originalOrder: { invoiceNo: { contains: search, mode: "insensitive" } } },
        { originalOrder: { fullName:  { contains: search, mode: "insensitive" } } },
        { newInvoiceNo:  { contains: search, mode: "insensitive" } },
        { trackingReturned: { contains: search, mode: "insensitive" } },
      ],
    } : undefined,
    include: {
      originalOrder: {
        select: {
          id: true, invoiceNo: true, fullName: true, email: true,
          country: true, currency: true, accountId: true,
          orderEntry: {
            select: { shipmentMode: true, shippingPrice: true },
          },
        },
      },
      items: {
        include: { product: { select: { id: true, name: true, pack: true } } },
      },
    },
  });

  return NextResponse.json({
    returns: returns.map(r => ({
      id:              r.id,
      returnDate:      r.returnDate.toISOString(),
      reason:          r.reason,
      trackingReturned: r.trackingReturned,
      returnType:      r.returnType,
      newShippingCost: r.newShippingCost ? Number(r.newShippingCost) : null,
      newShippingMode: r.newShippingMode,
      newOrderId:      r.newOrderId,
      newInvoiceNo:    r.newInvoiceNo,
      notes:           r.notes,
      createdAt:       r.createdAt.toISOString(),
      originalOrder: {
        id:          r.originalOrder.id,
        invoiceNo:   r.originalOrder.invoiceNo,
        fullName:    r.originalOrder.fullName,
        email:       r.originalOrder.email,
        country:     r.originalOrder.country,
        currency:    r.originalOrder.currency,
        accountId:   r.originalOrder.accountId,
        shipmentMode: r.originalOrder.orderEntry?.shipmentMode ?? null,
        shippingPrice: r.originalOrder.orderEntry?.shippingPrice
          ? Number(r.originalOrder.orderEntry.shippingPrice) : null,
      },
      items: r.items.map(i => ({
        id:           i.id,
        productId:    i.productId,
        productName:  i.productName,
        pack:         i.product.pack,
        quantity:     i.quantity,
        sellingPrice: Number(i.sellingPrice),
      })),
    })),
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    originalOrderId,
    returnDate,
    reason,
    trackingReturned,
    returnType,        // "REORDER" | "STOCK_RETURN"
    newShippingCost,   // number — only for REORDER
    newShippingMode,   // string — only for REORDER
    notes,
    items,             // [{ productId, productName, quantity, sellingPrice }]
  } = body;

  if (!originalOrderId) return NextResponse.json({ error: "originalOrderId required" }, { status: 400 });
  if (!returnType)      return NextResponse.json({ error: "returnType required" },      { status: 400 });
  if (!items?.length)   return NextResponse.json({ error: "items required" },           { status: 400 });

  // ── Load original order ──────────────────────────────────────────────────────
  const original = await prisma.orderInitiation.findUnique({
    where: { id: originalOrderId },
    include: {
      orderEntry: {
        include: { items: { include: { product: true } } },
      },
      account: true,
    },
  });

  if (!original) return NextResponse.json({ error: "Original order not found" }, { status: 404 });
  if (!original.invoiceNo) return NextResponse.json({ error: "Original order has no invoice" }, { status: 400 });

  // ── REORDER flow ─────────────────────────────────────────────────────────────
  if (returnType === "REORDER") {
    if (!newShippingCost || newShippingCost <= 0)
      return NextResponse.json({ error: "newShippingCost required for REORDER" }, { status: 400 });
    if (!newShippingMode)
      return NextResponse.json({ error: "newShippingMode required for REORDER" }, { status: 400 });

    const fy = getFinancialYear();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Generate new invoice number
      const seq = await tx.invoiceSequence.upsert({
        where:  { financialYear: fy },
        create: { financialYear: fy, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      const newInvoiceNo = `E-${fy}-${seq.lastNumber.toString().padStart(3, "0")}`;

      // 2. Create new OrderInitiation (clone client details, shipping cost only as amount)
      const newOrder = await tx.orderInitiation.create({
        data: {
          source:         "SALES",
          filledByUserId: session.id,
          fullName:       original.fullName,
          address:        original.address,
          city:           original.city,
          state:          original.state,
          postalCode:     original.postalCode,
          country:        original.country,
          email:          original.email,
          phone:          original.phone,
          remitterName:   original.remitterName,
          amountPaid:     newShippingCost,
          currency:       original.currency,
          status:         "PACKING",
          invoiceNo:      newInvoiceNo,
          invoiceGeneratedAt: new Date(),
          accountId:      original.accountId ?? null,
        },
      });

      // 3. Create OrderEntry with items + new shipping price
      const newEntry = await tx.orderEntry.create({
        data: {
          orderId:      newOrder.id,
          shippingPrice: newShippingCost,
          shipmentMode:  newShippingMode as any,
          notes: `Reshipping of returned goods — original invoice: ${original.invoiceNo}`,
        },
      });

      // 4. Clone order items
      if (original.orderEntry?.items?.length) {
        // Use the returned items list (may be subset of original)
        for (const item of items) {
          await tx.orderEntryItem.create({
            data: {
              orderEntryId: newEntry.id,
              productId:    item.productId,
              quantity:     item.quantity,
              sellingPrice: item.sellingPrice,
            },
          });
        }
      }

      // 5. Client ledger entry — debit the shipping cost
      if (original.accountId) {
        await tx.accountLedger.create({
          data: {
            accountId: original.accountId,
            type:      "DEBIT",
            amount:    newShippingCost,
            note:      `Reshipping charge — Invoice ${newInvoiceNo} (return of ${original.invoiceNo})`,
            orderId:   newOrder.id,
          },
        });
        // Update client account balance
        await tx.clientAccount.update({
          where: { id: original.accountId },
          data:  { balance: { decrement: newShippingCost } },
        });
      }

      // 6. Create ExportReturn record
      const exportReturn = await tx.exportReturn.create({
        data: {
          originalOrderId,
          returnDate:      returnDate ? new Date(returnDate) : new Date(),
          reason:          reason ?? null,
          trackingReturned: trackingReturned ?? null,
          returnType:      "REORDER",
          newShippingCost,
          newShippingMode,
          newOrderId:      newOrder.id,
          newInvoiceNo,
          notes:           notes ?? null,
          items: {
            create: items.map((i: any) => ({
              productId:   i.productId,
              productName: i.productName,
              quantity:    i.quantity,
              sellingPrice: i.sellingPrice,
            })),
          },
        },
      });

      return { exportReturn, newInvoiceNo, newOrderId: newOrder.id };
    });

    return NextResponse.json({ ok: true, ...result });
  }

  // ── STOCK_RETURN flow ─────────────────────────────────────────────────────────
  const exportReturn = await prisma.exportReturn.create({
    data: {
      originalOrderId,
      returnDate:      returnDate ? new Date(returnDate) : new Date(),
      reason:          reason ?? null,
      trackingReturned: trackingReturned ?? null,
      returnType:      "STOCK_RETURN",
      notes:           notes ?? null,
      items: {
        create: items.map((i: any) => ({
          productId:    i.productId,
          productName:  i.productName,
          quantity:     i.quantity,
          sellingPrice: i.sellingPrice,
        })),
      },
    },
  });

  return NextResponse.json({ ok: true, exportReturn });
}
