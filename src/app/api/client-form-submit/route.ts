import { NextResponse } from "next/server";
import { prisma, } from "../../../lib/prisma";
import { Prisma, OrderSource } from "@prisma/client";

export const runtime = "nodejs"; // keep Prisma + crypto stable on dev

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

    // 1) "Lock" the link WITHOUT a transaction:
    // Update only if link exists, not used, not expired
    const lock = await prisma.clientFormLink.updateMany({
      where: {
        token,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    // If nothing updated, it means invalid/expired/used
    if (lock.count === 0) {
      const existing = await prisma.clientFormLink.findUnique({
        where: { token },
        select: { isUsed: true, expiresAt: true },
      });

      if (!existing) return NextResponse.json({ error: "Invalid link" }, { status: 400 });
      if (existing.isUsed) return NextResponse.json({ error: "Link already used" }, { status: 400 });
      return NextResponse.json({ error: "Link expired" }, { status: 400 });
    }

    // 2) Create order
    const order = await prisma.orderInitiation.create({
      data: {
        source: OrderSource.CLIENT,
        clientFormToken: token,
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

    // 3) Attach orderId to link (best-effort)
    await prisma.clientFormLink.update({
      where: { token },
      data: { orderId: order.id },
    });

    return NextResponse.json({ orderId: order.id });
  } catch (e: any) {
    console.error("client-form-submit error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed" },
      { status: 400 }
    );
  }
}
