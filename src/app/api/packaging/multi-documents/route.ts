// GET /api/packaging/multi-documents?invoiceNo=E-2526-001
// Downloads a combined ZIP of all documents for orders sharing the same invoice number
import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";
import { buildMultiOrderDocumentBundle } from "../../../../lib/orderDocumentBundle";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "PACKAGING"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const invoiceNo = searchParams.get("invoiceNo");
  if (!invoiceNo)
    return NextResponse.json({ error: "invoiceNo required" }, { status: 400 });

  const orders = await prisma.orderInitiation.findMany({
    where: { invoiceNo },
    select: {
      id: true,
      invoiceNo: true,
      invoiceGeneratedAt: true,
      createdAt: true,
      fullName: true,
      address: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      remitterName: true,
      currency: true,
      exchangeRate: true,
      dollarAmount: true,
      prescriptionOriginalName: true,
      prescriptionStoredName: true,
      orderEntry: {
        select: {
          shipmentMode: true,
          shippingPrice: true,
          items: {
            select: {
              quantity: true,
              product: {
                select: {
                  name: true,
                  composition: true,
                  manufacturer: true,
                  hsn: true,
                  pack: true,
                  gstPercent: true,
                  batchNo: true,
                  mfgDate: true,
                  expDate: true,
                  PurchaseItems: {
                    select: { rate: true },
                    orderBy: { id: "desc" },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (orders.length === 0)
    return NextResponse.json(
      { error: "No orders found for this invoice number" },
      { status: 404 }
    );

  // Fetch weights + trackingNo via raw SQL
  const ids = orders.map((o) => o.id);
  const extraRows = await prisma.$queryRaw<
    { id: string; netWeight: number | null; grossWeight: number | null; trackingNo: string | null }[]
  >`SELECT id, "netWeight", "grossWeight", "trackingNo" FROM "OrderInitiation" WHERE id = ANY(${ids})`;
  const extraMap = Object.fromEntries(extraRows.map((r) => [r.id, r]));

  const bundleOrders = orders.map((order) => {
    const extra = extraMap[order.id] ?? {};
    const items =
      order.orderEntry?.items.map((item) => {
        const latestRate = item.product.PurchaseItems[0]?.rate ?? null;
        const inrUnit =
          latestRate != null ? Math.round(latestRate * 1.15 * 100) / 100 : null;
        return {
          productName: item.product.name,
          composition: item.product.composition,
          manufacturer: item.product.manufacturer,
          hsn: item.product.hsn,
          pack: item.product.pack,
          gstPercent: item.product.gstPercent,
          batchNo: item.product.batchNo,
          mfgDate: item.product.mfgDate,
          expDate: item.product.expDate,
          quantity: item.quantity,
          inrUnit,
          amount:
            inrUnit != null
              ? Math.round(inrUnit * item.quantity * 100) / 100
              : null,
        };
      }) ?? [];

    return {
      id: order.id,
      invoiceNo: order.invoiceNo,
      invoiceGeneratedAt: order.invoiceGeneratedAt,
      createdAt: order.createdAt,
      fullName: order.fullName,
      address: order.address,
      city: order.city,
      state: order.state,
      postalCode: order.postalCode,
      country: order.country,
      remitterName: order.remitterName,
      currency: order.currency,
      shipmentMode: order.orderEntry?.shipmentMode ?? null,
      shippingPrice: order.orderEntry ? Number(order.orderEntry.shippingPrice) : 0,
      exchangeRate: order.exchangeRate ? Number(order.exchangeRate) : 84,
      dollarAmount: order.dollarAmount ? Number(order.dollarAmount) : null,
      prescriptionOriginalName: order.prescriptionOriginalName,
      prescriptionStoredName: order.prescriptionStoredName,
      netWeight: (extra as { netWeight?: number | null }).netWeight ?? null,
      grossWeight: (extra as { grossWeight?: number | null }).grossWeight ?? null,
      trackingNo: (extra as { trackingNo?: string | null }).trackingNo ?? null,
      items,
    };
  });

  const { buffer, fileName } = await buildMultiOrderDocumentBundle(bundleOrders);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
