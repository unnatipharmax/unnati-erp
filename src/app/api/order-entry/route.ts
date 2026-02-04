import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { Prisma, ShipmentMode, LedgerType } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, shippingPrice, shipmentMode, notes, items } = body;

    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });
    if (!shipmentMode) return NextResponse.json({ error: "shipmentMode required" }, { status: 400 });
    if (!Array.isArray(items) || items.length === 0)
      return NextResponse.json({ error: "At least 1 item required" }, { status: 400 });

    for (const it of items) {
      if (!it.productId) return NextResponse.json({ error: "productId required" }, { status: 400 });
      if (!it.quantity || Number(it.quantity) <= 0)
        return NextResponse.json({ error: "quantity must be > 0" }, { status: 400 });
      if (it.sellingPrice === undefined || it.sellingPrice === null)
        return NextResponse.json({ error: "sellingPrice required" }, { status: 400 });
    }

    const ship = new Prisma.Decimal(String(shippingPrice || "0"));

    // total = sum(qty*price) + shipping
    const itemsTotal = items.reduce((sum: Prisma.Decimal, it: any) => {
      const q = Number(it.quantity);
      const p = new Prisma.Decimal(String(it.sellingPrice));
      return sum.add(p.mul(q));
    }, new Prisma.Decimal("0"));

    const orderTotal = itemsTotal.add(ship);

    const result = await prisma.$transaction(async (tx) => {
      // 1) load order + account
      const order = await tx.orderInitiation.findUnique({
        where: { id: orderId },
        select: { id: true, accountId: true, status: true, orderValue: true }
      });

      if (!order) throw new Error("Order not found");

      // 2) upsert orderEntry + replace items
      const entry = await tx.orderEntry.upsert({
        where: { orderId },
        create: {
          orderId,
          shipmentMode: shipmentMode as ShipmentMode,
          shippingPrice: ship,
          notes: notes || null,
          items: {
            create: items.map((it: any) => ({
              productId: it.productId,
              quantity: Number(it.quantity),
              sellingPrice: new Prisma.Decimal(String(it.sellingPrice)),
            })),
          },
        },
        update: {
          shipmentMode: shipmentMode as ShipmentMode,
          shippingPrice: ship,
          notes: notes || null,
          items: {
            deleteMany: {},
            create: items.map((it: any) => ({
              productId: it.productId,
              quantity: Number(it.quantity),
              sellingPrice: new Prisma.Decimal(String(it.sellingPrice)),
            })),
          },
        },
        select: { id: true },
      });

      // 3) If order is tied to an advance account, apply balance delta
if (order.accountId) {
  const prevValue = order.orderValue ?? new Prisma.Decimal("0");
  const delta = orderTotal.sub(prevValue); // +ve => extra debit, -ve => refund

  if (!delta.isZero()) {
    const account = await tx.clientAccount.findUnique({
      where: { id: order.accountId },
      select: { id: true, balance: true },
    });

    if (!account) throw new Error("Client account not found");

    // If delta is positive, check balance
    if (delta.greaterThan(0) && account.balance.lessThan(delta)) {
      throw new Error("Insufficient balance for this order");
    }

    // Update balance
    await tx.clientAccount.update({
      where: { id: account.id },
      data: { balance: account.balance.sub(delta) }, // subtract delta (refund adds back)
    });

    // Ledger row for audit
    await tx.accountLedger.create({
      data: {
        accountId: account.id,
        orderId: orderId,
        type: delta.greaterThan(0) ? LedgerType.DEBIT : LedgerType.CREDIT,
        amount: delta.abs(),
        note: delta.greaterThan(0) ? "Order debit" : "Order refund",
      },
    });
  }

  // IMPORTANT: store latest orderValue so next edit delta is correct
  await tx.orderInitiation.update({
    where: { id: orderId },
    data: { orderValue: orderTotal },
  });
}


      // 4) update order status
      await tx.orderInitiation.update({
        where: { id: orderId },
        data: { status: "SALES_UPDATED" },
      });

      return { entryId: entry.id, orderTotal: orderTotal.toString() };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
