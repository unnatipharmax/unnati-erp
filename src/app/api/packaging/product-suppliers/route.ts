// GET /api/packaging/product-suppliers?productIds=id1,id2,...
// Returns past suppliers for each product, sorted by cheapest rate first.
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "PACKAGING"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("productIds") ?? "";
  const productIds = raw.split(",").map((s) => s.trim()).filter(Boolean);

  if (productIds.length === 0)
    return NextResponse.json({});

  // Fetch all purchase items for these products
  const purchaseItems = await prisma.purchaseItem.findMany({
    where: { productId: { in: productIds } },
    select: {
      productId: true,
      rate: true,
      quantity: true,
      purchase: {
        select: {
          invoiceNo: true,
          invoiceDate: true,
          party: {
            select: {
              id: true,
              name: true,
              address: true,
              emails: { select: { email: true }, take: 1 },
              phones: { select: { phone: true }, take: 1 },
            },
          },
        },
      },
    },
  });

  // Group by productId → partyId, keep the min rate per party per product
  type SupplierKey = string; // `${productId}::${partyId}`
  const bestRateMap = new Map<SupplierKey, {
    productId: string;
    partyId: string;
    partyName: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    bestRate: number;
    bestQty: number;
    lastDate: string | null;
    invoiceNo: string | null;
  }>();

  for (const item of purchaseItems) {
    const party = item.purchase.party;
    const key: SupplierKey = `${item.productId}::${party.id}`;
    const existing = bestRateMap.get(key);

    const billDate = item.purchase.invoiceDate
      ? item.purchase.invoiceDate.toISOString().split("T")[0]
      : null;

    if (!existing || item.rate < existing.bestRate) {
      bestRateMap.set(key, {
        productId: item.productId,
        partyId: party.id,
        partyName: party.name,
        address: party.address ?? null,
        phone: party.phones[0]?.phone ?? null,
        email: party.emails[0]?.email ?? null,
        bestRate: item.rate,
        bestQty: item.quantity,
        lastDate: billDate,
        invoiceNo: item.purchase.invoiceNo ?? null,
      });
    }
  }

  // Build result grouped by productId
  const result: Record<string, typeof Array.prototype> = {};
  for (const productId of productIds) {
    result[productId] = [];
  }

  for (const entry of bestRateMap.values()) {
    if (result[entry.productId]) {
      result[entry.productId].push({
        partyId: entry.partyId,
        partyName: entry.partyName,
        address: entry.address,
        phone: entry.phone,
        email: entry.email,
        bestRate: entry.bestRate,
        bestQty: entry.bestQty,
        lastDate: entry.lastDate,
        invoiceNo: entry.invoiceNo,
      });
    }
  }

  // Sort each product's suppliers by bestRate ascending (cheapest first)
  for (const productId of productIds) {
    result[productId].sort((a: any, b: any) => a.bestRate - b.bestRate);
  }

  return NextResponse.json(result);
}
