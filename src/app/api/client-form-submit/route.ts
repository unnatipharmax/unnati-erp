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

    // -------------------------
    // 1) Try SINGLE link first
    // -------------------------
    const singleLink = await prisma.clientFormLink.findUnique({
      where: { token },
      select: { token: true, isUsed: true, expiresAt: true },
    });

    if (singleLink) {
      // lock link (only if not used and not expired)
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

      if (lock.count === 0) {
        if (singleLink.isUsed)
          return NextResponse.json({ error: "Link already used" }, { status: 400 });
        return NextResponse.json({ error: "Link expired" }, { status: 400 });
      }

      // create ONE order
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

      // attach orderId to link (best-effort)
      await prisma.clientFormLink.update({
        where: { token },
        data: { orderId: order.id },
      });

      return NextResponse.json({ orderId: order.id, linkType: "single" });
    }

    // -------------------------
    // 2) Else try MULTI link
    // -------------------------
    const multiLink = await prisma.clientAccountLink.findUnique({
      where: { token },
      select: { token: true, isActive: true, accountId: true },
    });

    if (!multiLink || !multiLink.isActive) {
      return NextResponse.json({ error: "Invalid link" }, { status: 400 });
    }

    // For advance-account flow: amountPaid/remitterName may be optional.
    // If you still want to collect them, keep them; else default to 0.
    const order = await prisma.orderInitiation.create({
      data: {
        source: OrderSource.CLIENT,
        clientFormToken: token, // keep token for audit, even in multi
        accountId: multiLink.accountId,

        fullName,
        address,
        city,
        state,
        postalCode,
        country,
        email,
        phone,

        remitterName: remitterName || null,
        amountPaid: new Prisma.Decimal(String(amountPaid || "0")),
        currency: currency || "INR",
      },
      select: { id: true },
    });

    // DO NOT mark token used. DO NOT set orderId on link (because many orders)
    return NextResponse.json({ orderId: order.id, linkType: "multi" });
  } catch (e: any) {
    console.error("client-form-submit error:", e);
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}
