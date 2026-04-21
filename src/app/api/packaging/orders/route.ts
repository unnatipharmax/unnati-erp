// src/app/api/packaging/orders/route.ts
// GET — orders ready for packaging (PAYMENT_VERIFIED or PACKING)
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "PACKAGING"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orders = await prisma.orderInitiation.findMany({
    where:   { status: { in: ["PAYMENT_VERIFIED", "PACKING"] } },
    orderBy: { id: "desc" },
    select: {
      id: true, fullName: true, address: true, city: true,
      state: true, postalCode: true, country: true,
      email: true, phone: true, remitterName: true,
      amountPaid: true, currency: true,
      status: true, invoiceNo: true, invoiceGeneratedAt: true,
      trackingNo: true, licenseNo: true,
      prescriptionOriginalName: true,
      exchangeRate: true, dollarAmount: true, inrAmount: true,
      createdAt: true, accountId: true,
      orderEntry: {
        select: {
          shipmentMode: true, shippingPrice: true, notes: true,
          items: {
            select: {
              quantity: true, sellingPrice: true,
              product: {
                select: {
                  id: true, name: true, manufacturer: true,
                  hsn: true, pack: true, gstPercent: true,
                  composition: true, batchNo: true,
                  mfgDate: true, expDate: true,
                  // Latest purchase rate for INR Unit
                  PurchaseItems: {
                    select: { rate: true },
                    orderBy: { id: "desc" },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // Fetch netWeight and grossWeight via raw SQL (columns added post-migration)
  const orderIds = orders.map(o => o.id);
  const weightMap: Record<string, { netWeight: number | null; grossWeight: number | null }> = {};
  if (orderIds.length > 0) {
    const weightRows = await prisma.$queryRaw<{ id: string; netWeight: number | null; grossWeight: number | null }[]>`
      SELECT id, "netWeight", "grossWeight" FROM "OrderInitiation" WHERE id = ANY(${orderIds}::text[])
    `;
    for (const r of weightRows) weightMap[r.id] = { netWeight: r.netWeight, grossWeight: r.grossWeight };
  }

  // Collect unique product IDs from all orders, then fetch current stock qty
  // via raw SQL to avoid stale-Prisma-client type errors (qty was recently added).
  const productIds = [
    ...new Set(
      orders.flatMap(o =>
        (o.orderEntry?.items ?? []).map(i => i.product.id)
      )
    ),
  ];

  const stockMap: Record<string, number | null> = {};
  if (productIds.length > 0) {
    const rows = await prisma.$queryRaw<{ id: string; qty: number | null }[]>`
      SELECT id, qty FROM "Product" WHERE id = ANY(${productIds}::text[])
    `;
    for (const r of rows) stockMap[r.id] = r.qty ?? null;
  }

  return NextResponse.json({
    orders: orders.map(o => {
      const entry = o.orderEntry;
      const items = (entry?.items ?? []).map(i => {
        const rate    = i.product.PurchaseItems[0]?.rate ?? null;
        const rateNum = rate != null ? Number(rate) : null;
        const inrUnit = rateNum != null ? Math.round(rateNum * 1.15 * 100) / 100 : null;
        return {
          productId:    i.product.id,
          productName:  i.product.name,
          composition:  i.product.composition,
          manufacturer: i.product.manufacturer,
          hsn:          i.product.hsn,
          pack:         i.product.pack,
          gstPercent:   i.product.gstPercent,
          batchNo:      i.product.batchNo,
          mfgDate:      i.product.mfgDate,
          expDate:      i.product.expDate,
          quantity:     i.quantity,
          sellingPrice: Number(i.sellingPrice),       // USD selling price
          latestRate:   rateNum,                      // purchase rate in INR per unit
          inrUnit,                                    // purchase rate + 15% margin
          amount:       inrUnit != null ? Math.round(inrUnit * i.quantity * 100) / 100 : null,
          stockQty:     stockMap[i.product.id] ?? null, // current stock from Product master
        };
      });

      const totalInr = items.reduce((s, i) => s + (i.amount ?? 0), 0);

      return {
        id:              o.id,
        accountId:       o.accountId ?? null,
        invoiceNo:       o.invoiceNo,
        invoiceGeneratedAt: o.invoiceGeneratedAt?.toISOString() ?? null,
        status:          o.status,
        fullName:        o.fullName,
        address:         o.address,
        city:            o.city,
        state:           o.state,
        postalCode:      o.postalCode,
        country:         o.country,
        remitterName:    o.remitterName,
        amountPaid:      Number(o.amountPaid),
        currency:        o.currency,
        exchangeRate:    o.exchangeRate ? Number(o.exchangeRate) : 84,
        dollarAmount:    o.dollarAmount ? Number(o.dollarAmount) : null,
        inrAmount:       o.inrAmount    ? Number(o.inrAmount)    : null,
        createdAt:       o.createdAt.toISOString(),
        shipmentMode:    entry?.shipmentMode ?? null,
        shippingPrice:   entry ? Number(entry.shippingPrice) : 0,
        trackingNo:      o.trackingNo,
        licenseNo:       o.licenseNo,
        netWeight:       weightMap[o.id]?.netWeight ?? null,
        grossWeight:     weightMap[o.id]?.grossWeight ?? null,
        prescriptionFileName: o.prescriptionOriginalName ?? null,
        items,
        totalInr:        Math.round(totalInr * 100) / 100,
        totalUsd:        o.dollarAmount ? Number(o.dollarAmount) : null,
      };
    }),
  });
}
