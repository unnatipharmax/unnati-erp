// GET /api/daily-order-book?date=YYYY-MM-DD
// Returns orders booked/dispatched on the given date, shaped as Daily Order
// Book rows (the postal "Booking Order Sheet" format).
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/auth";

export const runtime = "nodejs";

export type BookingRow = {
  serviceMode: string;   // EMS / ITPS / ...
  date: string;          // yyyy-mm-dd
  name: string;
  add1: string;          // composed multi-line address block
  city: string;
  state: string;
  pincode: string;
  addrMobile: string;
  addrEmail: string;
  barcode: string;       // tracking number
  weight: string;        // grams
  ref: string;           // order/declared value
  country: string;
};

function composeAddress(o: {
  address: string; city: string; state: string; postalCode: string; country: string;
}): string {
  const lines = [
    o.address,
    o.city ? `City: ${o.city}` : "",
    o.state ? `State: ${o.state}` : "",
    o.postalCode ? `Pin code: ${o.postalCode}` : "",
    o.country ? `Country : ${o.country}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "PACKAGING", "ACCOUNTS"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  if (!dateStr) return NextResponse.json({ error: "date is required" }, { status: 400 });

  const from = new Date(dateStr + "T00:00:00.000Z");
  if (isNaN(from.getTime())) return NextResponse.json({ error: "invalid date" }, { status: 400 });
  const to = new Date(from);
  to.setUTCHours(23, 59, 59, 999);

  // Orders booked that day: prefer invoiceGeneratedAt (booking moment), else createdAt.
  const orders = await prisma.orderInitiation.findMany({
    where: {
      status: { in: ["PACKING", "DISPATCHED"] },
      invoiceNo: { not: null },
      OR: [
        { invoiceGeneratedAt: { gte: from, lte: to } },
        { AND: [{ invoiceGeneratedAt: null }, { createdAt: { gte: from, lte: to } }] },
      ],
    },
    orderBy: [{ invoiceGeneratedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, fullName: true, address: true, city: true, state: true,
      postalCode: true, country: true, email: true, phone: true,
      trackingNo: true, dollarAmount: true, amountPaid: true,
      invoiceGeneratedAt: true, createdAt: true,
      orderEntry: { select: { shipmentMode: true } },
    },
  });

  // Parcel weights live on OrderInitiation but not in the Prisma schema → raw SQL
  const ids = orders.map(o => o.id);
  const weightMap: Record<string, number | null> = {};
  if (ids.length) {
    const rows = await prisma.$queryRaw<{ id: string; netWeight: number | null }[]>`
      SELECT id, "netWeight" FROM "OrderInitiation" WHERE id = ANY(${ids}::text[])
    `;
    for (const r of rows) weightMap[r.id] = r.netWeight;
  }

  const bookingRows: BookingRow[] = orders.map(o => {
    const grams = weightMap[o.id] != null ? Math.round((weightMap[o.id] as number) * 1000) : null;
    const value = o.dollarAmount != null ? Number(o.dollarAmount) : Number(o.amountPaid);
    return {
      serviceMode: o.orderEntry?.shipmentMode ?? "",
      date: (o.invoiceGeneratedAt ?? o.createdAt).toISOString().slice(0, 10),
      name: o.fullName,
      add1: composeAddress(o),
      city: o.city,
      state: o.state,
      pincode: o.postalCode,
      addrMobile: o.phone ?? "",
      addrEmail: o.email ?? "",
      barcode: o.trackingNo ?? "",
      weight: grams != null ? String(grams) : "",
      ref: value ? String(Math.round(value)) : "",
      country: o.country,
    };
  });

  return NextResponse.json({ rows: bookingRows });
}
