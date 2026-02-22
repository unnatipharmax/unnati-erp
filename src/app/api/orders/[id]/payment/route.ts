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

    const order = await prisma.orderInitiation.update({
      where: { id },
      data,
      select: {
        id: true,
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
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}