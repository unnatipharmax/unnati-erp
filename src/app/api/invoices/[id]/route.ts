// PATCH /api/invoices/[id] — edit any field of an existing invoice
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";
import { Prisma, ShipmentMode } from "@prisma/client";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body    = await req.json();

  const order = await prisma.orderInitiation.findUnique({
    where: { id },
    select: { id: true, invoiceNo: true },
  });
  if (!order || !order.invoiceNo)
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      // ── 1. OrderInitiation fields ──────────────────────────────────────────
      const initData: Prisma.OrderInitiationUpdateInput = {};

      if (body.fullName    !== undefined) initData.fullName    = body.fullName    || order.invoiceNo!;
      if (body.address     !== undefined) initData.address     = body.address;
      if (body.city        !== undefined) initData.city        = body.city;
      if (body.state       !== undefined) initData.state       = body.state;
      if (body.postalCode  !== undefined) initData.postalCode  = body.postalCode;
      if (body.country     !== undefined) initData.country     = body.country;
      if (body.email       !== undefined) initData.email       = body.email;
      if (body.phone       !== undefined) initData.phone       = body.phone;
      if (body.remitterName !== undefined) initData.remitterName = body.remitterName;
      if (body.amountPaid  !== undefined) initData.amountPaid  = new Prisma.Decimal(String(body.amountPaid || 0));
      if (body.currency    !== undefined) initData.currency    = body.currency;
      if (body.exchangeRate !== undefined) initData.exchangeRate = body.exchangeRate ? new Prisma.Decimal(String(body.exchangeRate)) : null;
      if (body.dollarAmount !== undefined) initData.dollarAmount = body.dollarAmount ? new Prisma.Decimal(String(body.dollarAmount)) : null;
      if (body.inrAmount   !== undefined) initData.inrAmount   = body.inrAmount   ? new Prisma.Decimal(String(body.inrAmount))   : null;
      if (body.trackingNo  !== undefined) initData.trackingNo  = body.trackingNo  || null;
      if (body.licenseNo   !== undefined) initData.licenseNo   = body.licenseNo   || null;
      if (body.invoiceGeneratedAt !== undefined)
        initData.invoiceGeneratedAt = body.invoiceGeneratedAt ? new Date(body.invoiceGeneratedAt) : null;

      if (Object.keys(initData).length > 0) {
        await tx.orderInitiation.update({ where: { id }, data: initData });
      }

      // ── 2. OrderEntry fields (shipment + items) ────────────────────────────
      if (body.shipmentMode !== undefined || body.shippingPrice !== undefined ||
          body.notes !== undefined || body.items !== undefined) {

        const entryExists = await tx.orderEntry.findUnique({ where: { orderId: id }, select: { id: true } });

        const entryData: Prisma.OrderEntryUpdateInput = {};
        if (body.shipmentMode  !== undefined) entryData.shipmentMode  = body.shipmentMode as ShipmentMode;
        if (body.shippingPrice !== undefined) entryData.shippingPrice = new Prisma.Decimal(String(body.shippingPrice || 0));
        if (body.notes         !== undefined) entryData.notes         = body.notes || null;

        if (body.items !== undefined && Array.isArray(body.items)) {
          entryData.items = {
            deleteMany: {},
            create: body.items.map((it: { productId: string; quantity: number; sellingPrice: number }) => ({
              productId:    it.productId,
              quantity:     Number(it.quantity),
              sellingPrice: new Prisma.Decimal(String(it.sellingPrice)),
            })),
          };
        }

        if (entryExists) {
          await tx.orderEntry.update({ where: { orderId: id }, data: entryData });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
