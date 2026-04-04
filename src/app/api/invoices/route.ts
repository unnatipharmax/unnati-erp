// GET /api/invoices — all orders that have an invoice number (any invoiced status)
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";

  const orders = await prisma.orderInitiation.findMany({
    where: {
      invoiceNo: { not: null },
      ...(search ? {
        OR: [
          { invoiceNo:  { contains: search, mode: "insensitive" } },
          { fullName:   { contains: search, mode: "insensitive" } },
          { email:      { contains: search, mode: "insensitive" } },
          { trackingNo: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: { invoiceGeneratedAt: "desc" },
    select: {
      id: true,
      invoiceNo: true,
      invoiceGeneratedAt: true,
      status: true,
      fullName: true,
      address: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      email: true,
      phone: true,
      remitterName: true,
      amountPaid: true,
      currency: true,
      exchangeRate: true,
      dollarAmount: true,
      inrAmount: true,
      trackingNo: true,
      licenseNo: true,
      createdAt: true,
      orderEntry: {
        select: {
          shipmentMode: true,
          shippingPrice: true,
          notes: true,
          items: {
            select: {
              id: true,
              quantity: true,
              sellingPrice: true,
              product: { select: { id: true, name: true, composition: true, pack: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    orders: orders.map(o => ({
      ...o,
      amountPaid:  Number(o.amountPaid),
      exchangeRate: o.exchangeRate ? Number(o.exchangeRate) : null,
      dollarAmount: o.dollarAmount ? Number(o.dollarAmount) : null,
      inrAmount:    o.inrAmount    ? Number(o.inrAmount)    : null,
      invoiceGeneratedAt: o.invoiceGeneratedAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
      orderEntry: o.orderEntry ? {
        ...o.orderEntry,
        shippingPrice: Number(o.orderEntry.shippingPrice),
        items: o.orderEntry.items.map(i => ({
          id:           i.id,
          productId:    i.product.id,
          productName:  i.product.name,
          composition:  i.product.composition,
          pack:         i.product.pack,
          quantity:     i.quantity,
          sellingPrice: Number(i.sellingPrice),
        })),
      } : null,
    })),
  });
}
