// POST /api/client-quick-order/single
// Sales-team paste-and-create: build a single (non-account) client order directly
// from parsed message fields. No client link/token involved.
import { NextResponse } from "next/server";
import { Prisma, OrderSource } from "@prisma/client";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";
import { sendOrderConfirmation } from "../../../../lib/email";

export const runtime = "nodejs";

type Body = {
  fullName?: string; address?: string; city?: string; state?: string;
  postalCode?: string; country?: string; email?: string; phone?: string;
  remitterName?: string; amountPaid?: string; currency?: string;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "SALES", "ACCOUNTS"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b: Body = await req.json().catch(() => ({}));

  const fullName = (b.fullName ?? "").trim();
  const amountRaw = (b.amountPaid ?? "").trim().replace(/[^0-9.-]/g, "");
  if (!fullName) return NextResponse.json({ error: "Customer name is required" }, { status: 400 });

  try {
    const order = await prisma.orderInitiation.create({
      data: {
        source: OrderSource.SALES,
        filledByUserId: session.id ?? null,
        fullName,
        address:      (b.address ?? "").trim(),
        city:         (b.city ?? "").trim(),
        state:        (b.state ?? "").trim(),
        postalCode:   (b.postalCode ?? "").trim(),
        country:      (b.country ?? "").trim(),
        email:        (b.email ?? "").trim(),
        phone:        (b.phone ?? "").trim(),
        remitterName: (b.remitterName ?? "").trim() || fullName,
        amountPaid:   new Prisma.Decimal(String(amountRaw || "0")),
        currency:     (b.currency ?? "").trim().toUpperCase() || "USD",
      },
      select: { id: true },
    });

    if (b.email) {
      sendOrderConfirmation({ orderId: order.id, clientEmail: (b.email ?? "").trim(), clientName: fullName })
        .catch(e => console.error("Confirmation email error:", e));
    }

    return NextResponse.json({ orderId: order.id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
