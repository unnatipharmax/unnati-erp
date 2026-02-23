// src/app/api/orders/[id]/payment/route.ts
// PATCH — save payment details for an order (accounts team)
import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { getSession } from "../../../../../lib/auth";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body   = await req.json();

  try {
    const data: any = {};

    if (body.inrAmount        !== undefined) data.inrAmount        = body.inrAmount        ? Number(body.inrAmount)        : null;
    if (body.dollarAmount     !== undefined) data.dollarAmount     = body.dollarAmount     ? Number(body.dollarAmount)     : null;
    if (body.exchangeRate     !== undefined) data.exchangeRate     = body.exchangeRate     ? Number(body.exchangeRate)     : null;
    if (body.grsNumber        !== undefined) data.grsNumber        = body.grsNumber        || null;
    if (body.paymentDepositDate !== undefined) {
      data.paymentDepositDate = body.paymentDepositDate
        ? new Date(body.paymentDepositDate)
        : null;
    }

    // Auto-advance to PAYMENT_VERIFIED when all key payment fields are filled
    const hasPayment = (data.inrAmount || body.inrAmount) &&
                       (data.dollarAmount || body.dollarAmount) &&
                       (data.grsNumber || body.grsNumber);
    if (hasPayment) {
      // Only advance if currently INITIATED or SALES_UPDATED (don't go backward)
      const current = await prisma.orderInitiation.findUnique({
        where: { id }, select: { status: true }
      });
      if (current && ["INITIATED","SALES_UPDATED"].includes(current.status)) {
        data.status = "PAYMENT_VERIFIED";
      }
    }

    const order = await prisma.orderInitiation.update({
      where: { id },
      data,
      select: {
        id: true,
        status:             true,
        inrAmount:          true,
        dollarAmount:       true,
        exchangeRate:       true,
        grsNumber:          true,
        paymentDepositDate: true,
      },
    });

    return NextResponse.json({
      ...order,
      inrAmount:          order.inrAmount        ? Number(order.inrAmount)        : null,
      dollarAmount:       order.dollarAmount     ? Number(order.dollarAmount)     : null,
      exchangeRate:       order.exchangeRate     ? Number(order.exchangeRate)     : null,
      paymentDepositDate: order.paymentDepositDate?.toISOString().split("T")[0] ?? null,
      statusChanged:      data.status === "PAYMENT_VERIFIED",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}