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
      exchangeRate: true, dollarAmount: true, inrAmount: true,
      createdAt: true,
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

  return NextResponse.json({
    orders: orders.map(o => {
      const entry = o.orderEntry;
      const items = entry?.items.map(i => {
        const rate    = i.product.PurchaseItems[0]?.rate ?? null;
        const inrUnit = rate ? Math.round(rate * 1.15 * 100) / 100 : null;
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
          sellingPrice: Number(i.sellingPrice),   // USD selling price
          latestRate:   rate,
          inrUnit,                                 // purchase rate + 15%
          amount:       inrUnit ? Math.round(inrUnit * i.quantity * 100) / 100 : null,
        };
      }) ?? [];

      const totalInr = items.reduce((s, i) => s + (i.amount ?? 0), 0);

      return {
        id:              o.id,
        invoiceNo:       o.invoiceNo,
        invoiceGeneratedAt: o.invoiceGeneratedAt?.toISOString() ?? null,
        status:          o.status,
        fullName:        o.fullName,
        address:         o.address,
        city:            o.city,
        state:           o.state,
        postalCode:      o.postalCode,
        country:         o.country,
        remitterName:    o.remitterName,       // → Buyer's reference
        amountPaid:      Number(o.amountPaid),
        currency:        o.currency,
        exchangeRate:    o.exchangeRate ? Number(o.exchangeRate) : 84,
        dollarAmount:    o.dollarAmount ? Number(o.dollarAmount) : null,
        inrAmount:       o.inrAmount    ? Number(o.inrAmount)    : null,
        createdAt:       o.createdAt.toISOString(),
        shipmentMode:    entry?.shipmentMode ?? null,
        shippingPrice:   entry ? Number(entry.shippingPrice) : 0,
        items,
        totalInr:        Math.round(totalInr * 100) / 100,
        totalUsd:        o.dollarAmount ? Number(o.dollarAmount) : null,
      };
    }),
  });
}