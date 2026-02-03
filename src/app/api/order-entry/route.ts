import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { Prisma, ShipmentMode } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, shippingPrice, shipmentMode, notes, items } = body;

    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });
    if (!shipmentMode) return NextResponse.json({ error: "shipmentMode required" }, { status: 400 });
    if (!Array.isArray(items) || items.length === 0)
      return NextResponse.json({ error: "At least 1 item required" }, { status: 400 });

    // validate items
    for (const it of items) {
      if (!it.productId) return NextResponse.json({ error: "productId required" }, { status: 400 });
      if (!it.quantity || Number(it.quantity) <= 0)
        return NextResponse.json({ error: "quantity must be > 0" }, { status: 400 });
      if (it.sellingPrice === undefined || it.sellingPrice === null)
        return NextResponse.json({ error: "sellingPrice required" }, { status: 400 });
    }

    // fetch product names
    const productIds = items.map((i: any) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(products.map((p) => [p.id, p.name]));

    // Upsert entry (create if missing, else replace items)
    const entry = await prisma.orderEntry.upsert({
      where: { orderId },
      create: {
        orderId,
        shipmentMode: shipmentMode as ShipmentMode,
        shippingPrice: shippingPrice ? String(shippingPrice) : "0",
        notes: notes || null,
        items: {
          create: items.map((it: any) => ({
          product: { connect: { id: it.productId } },
          quantity: Number(it.quantity),
          sellingPrice: String(it.sellingPrice),
          })),
        },
      },
      update: {
        shipmentMode: shipmentMode as ShipmentMode,
        shippingPrice: shippingPrice ? String(shippingPrice) : "0",
        notes: notes || null,
        items: {
          deleteMany: {}, // wipe old items
          create: items.map((it: any) => ({
          product: { connect: { id: it.productId } },
          quantity: Number(it.quantity),
          sellingPrice: String(it.sellingPrice),
          })),
        },
      },
      select: { id: true },
    });

    // update order status
    await prisma.orderInitiation.update({
      where: { id: orderId },
      data: { status: "SALES_UPDATED" },
    });

    return NextResponse.json({ ok: true, entryId: entry.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
