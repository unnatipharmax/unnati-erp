import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { Prisma, OrderSource } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      token,
      fullName,
      address,
      city,
      state,
      postalCode,
      country,
      email,
      phone,
      remitterName,
      amountPaid,
      currency,
    } = body;

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    // 1️⃣ Validate multi-order link
    const link = await prisma.clientAccountLink.findUnique({
      where: { token },
      include: { account: true },
    });

    if (!link || !link.isActive || !link.account.isActive) {
      return NextResponse.json({ error: "Invalid or inactive link" }, { status: 400 });
    }

    // 2️⃣ Create order initiation (NO balance deduction here)
    const order = await prisma.orderInitiation.create({
      data: {
        source: OrderSource.CLIENT,
        clientFormToken: token,
        accountId: link.accountId,

        fullName,
        address,
        city,
        state,
        postalCode,
        country,
        email,
        phone,

        remitterName,
        amountPaid: new Prisma.Decimal(String(amountPaid || "0")),
        currency: currency || "INR",
      },
      select: { id: true },
    });

    return NextResponse.json({
      orderId: order.id,
      accountName: link.account.name,
      remainingBalance: link.account.balance, // unchanged for now
    });
  } catch (e: any) {
    console.error("client-multi-form-submit error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed" },
      { status: 400 }
    );
  }
}
