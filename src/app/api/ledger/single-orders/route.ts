// GET /api/ledger/single-orders — orders not linked to any account
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orders = await prisma.orderInitiation.findMany({
    where:   { accountId: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, fullName: true, email: true, phone: true,
      status: true, createdAt: true, orderValue: true,
      inrAmount: true, dollarAmount: true,
      exchangeRate: true, grsNumber: true, paymentDepositDate: true,
      orderEntry: {
        select: {
          shippingPrice: true, shipmentMode: true,
          items: {
            select: {
              quantity: true, sellingPrice: true,
              product: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    orders: orders.map(o => ({
      id:           o.id,
      fullName:     o.fullName,
      email:        o.email,
      phone:        o.phone,
      status:       o.status,
      createdAt:    o.createdAt.toISOString(),
      orderValue:   o.orderValue  ? Number(o.orderValue)  : null,
      brandName:    o.orderEntry?.items.map(i => i.product.name).join(", ") || null,
      quantity:     o.orderEntry?.items.reduce((s, i) => s + i.quantity, 0) ?? 0,
      shipmentMode: o.orderEntry?.shipmentMode ?? null,
      shippingPrice: o.orderEntry ? Number(o.orderEntry.shippingPrice) : 0,
      inrAmount:          o.inrAmount          ? Number(o.inrAmount)          : null,
      dollarAmount:       o.dollarAmount       ? Number(o.dollarAmount)       : null,
      exchangeRate:       o.exchangeRate       ? Number(o.exchangeRate)       : null,
      grsNumber:          o.grsNumber          ?? null,
      paymentDepositDate: o.paymentDepositDate
        ? o.paymentDepositDate.toISOString().split("T")[0]
        : null,
    })),
  });
}
