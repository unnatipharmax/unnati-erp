// GET /api/dashboard/reports
// Returns all analytics data for the dashboard in one call.
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";
import { getPurchaseBillAmount, roundMoney } from "../../../../lib/purchaseAccounting";
import { PurchaseDocumentType } from "@prisma/client";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── 1. Summary KPIs ──────────────────────────────────────────────────────────
  const [totalOrders, dispatchedOrders, totalProducts, totalParties] = await Promise.all([
    prisma.orderInitiation.count(),
    prisma.orderInitiation.findMany({
      where: { status: "DISPATCHED" },
      select: { dollarAmount: true, amountPaid: true, currency: true },
    }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.party.count({ where: { isActive: true } }),
  ]);

  const totalRevenue = dispatchedOrders.reduce((s, o) => {
    const amt = o.dollarAmount ? Number(o.dollarAmount) : Number(o.amountPaid);
    return s + amt;
  }, 0);

  // ── 2. Top Selling Products (by quantity) ────────────────────────────────────
  const topProductsRaw = await prisma.orderEntryItem.groupBy({
    by: ["productId"],
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 10,
  });

  const topProductIds = topProductsRaw.map(r => r.productId);
  const topProductInfo = await prisma.product.findMany({
    where: { id: { in: topProductIds } },
    select: { id: true, name: true, manufacturer: true },
  });
  const productMap = Object.fromEntries(topProductInfo.map(p => [p.id, p]));

  // Revenue per product (sum qty × sellingPrice)
  const topProductRevRaw = await prisma.orderEntryItem.groupBy({
    by: ["productId"],
    _sum: { quantity: true },
    where: { productId: { in: topProductIds } },
    orderBy: { _sum: { quantity: "desc" } },
  });

  // Also get revenue
  const revRows = await prisma.$queryRaw<{ productId: string; revenue: number }[]>`
    SELECT "productId", SUM(quantity * "sellingPrice") AS revenue
    FROM "OrderEntryItem"
    GROUP BY "productId"
    ORDER BY revenue DESC
    LIMIT 10
  `;
  const revMap = Object.fromEntries(revRows.map(r => [r.productId, Number(r.revenue)]));

  const topProducts = topProductsRaw.map(r => ({
    productId:   r.productId,
    productName: productMap[r.productId]?.name ?? r.productId,
    manufacturer: productMap[r.productId]?.manufacturer ?? null,
    totalQty:    r._sum.quantity ?? 0,
    totalRevenue: revMap[r.productId] ?? 0,
  }));

  // ── 3. Best Sellers by Revenue ───────────────────────────────────────────────
  const bestSellersRaw = await prisma.$queryRaw<{ productId: string; revenue: number; qty: number }[]>`
    SELECT "productId",
           SUM(quantity * "sellingPrice") AS revenue,
           SUM(quantity) AS qty
    FROM "OrderEntryItem"
    GROUP BY "productId"
    ORDER BY revenue DESC
    LIMIT 10
  `;

  const bsIds = bestSellersRaw.map(r => r.productId);
  const bsInfo = await prisma.product.findMany({
    where: { id: { in: bsIds } },
    select: { id: true, name: true, manufacturer: true },
  });
  const bsMap = Object.fromEntries(bsInfo.map(p => [p.id, p]));

  const bestSellers = bestSellersRaw.map(r => ({
    productId:    r.productId,
    productName:  bsMap[r.productId]?.name ?? r.productId,
    manufacturer: bsMap[r.productId]?.manufacturer ?? null,
    totalRevenue: roundMoney(Number(r.revenue)),
    totalQty:     Number(r.qty),
  }));

  // ── 4. Country-wise Sales ────────────────────────────────────────────────────
  const countryRaw = await prisma.$queryRaw<{ country: string; orderCount: number; totalAmt: number }[]>`
    SELECT country,
           COUNT(*)::int AS "orderCount",
           SUM(COALESCE("dollarAmount", "amountPaid"))::float AS "totalAmt"
    FROM "OrderInitiation"
    WHERE country IS NOT NULL AND country <> ''
    GROUP BY country
    ORDER BY "orderCount" DESC
    LIMIT 15
  `;

  const countrySales = countryRaw.map(r => ({
    country:    r.country,
    orderCount: Number(r.orderCount),
    totalRevenue: roundMoney(Number(r.totalAmt)),
  }));

  // ── 5. Monthly Revenue (last 12 months) ──────────────────────────────────────
  const monthlyRaw = await prisma.$queryRaw<{ month: string; orderCount: number; totalAmt: number }[]>`
    SELECT TO_CHAR("createdAt", 'YYYY-MM') AS month,
           COUNT(*)::int AS "orderCount",
           SUM(COALESCE("dollarAmount", "amountPaid"))::float AS "totalAmt"
    FROM "OrderInitiation"
    WHERE "createdAt" >= NOW() - INTERVAL '12 months'
    GROUP BY month
    ORDER BY month ASC
  `;

  const monthlyRevenue = monthlyRaw.map(r => ({
    month:      r.month,
    orderCount: Number(r.orderCount),
    totalRevenue: roundMoney(Number(r.totalAmt)),
  }));

  // ── 6. Pending Payments (purchase bills outstanding) ─────────────────────────
  const pendingBillsRaw = await prisma.purchaseBill.findMany({
    where: { documentType: PurchaseDocumentType.BILL, party: { isActive: true } },
    select: {
      id: true,
      invoiceNo: true,
      invoiceDate: true,
      totalAmount: true,
      party: { select: { id: true, name: true } },
      items: { select: { quantity: true, rate: true, taxableAmount: true, cgstAmount: true, sgstAmount: true, igstAmount: true } },
      allocations: { select: { amount: true } },
      adjustedByCreditNotes: { select: { amount: true } },
    },
  });

  const partyOutstanding: Record<string, { partyId: string; partyName: string; billCount: number; outstanding: number }> = {};
  for (const bill of pendingBillsRaw) {
    const billAmt  = bill.totalAmount != null ? roundMoney(Number(bill.totalAmount)) : getPurchaseBillAmount(bill.items);
    const paid     = roundMoney(bill.allocations.reduce((s, a) => s + Number(a.amount), 0));
    const cnAdj    = roundMoney(bill.adjustedByCreditNotes.reduce((s, a) => s + Number(a.amount), 0));
    const outstanding = Math.max(0, roundMoney(billAmt - paid - cnAdj));
    if (outstanding < 0.01) continue;

    if (!partyOutstanding[bill.party.id]) {
      partyOutstanding[bill.party.id] = { partyId: bill.party.id, partyName: bill.party.name, billCount: 0, outstanding: 0 };
    }
    partyOutstanding[bill.party.id].billCount++;
    partyOutstanding[bill.party.id].outstanding = roundMoney(partyOutstanding[bill.party.id].outstanding + outstanding);
  }

  const pendingPayments = Object.values(partyOutstanding)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 10);

  const totalPendingAmount = roundMoney(Object.values(partyOutstanding).reduce((s, p) => s + p.outstanding, 0));

  // ── 7. Returned Shipments (Credit Notes) ────────────────────────────────────
  const creditNotes = await prisma.purchaseBill.findMany({
    where: { documentType: PurchaseDocumentType.CREDIT_NOTE },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      invoiceNo: true,
      invoiceDate: true,
      createdAt: true,
      totalAmount: true,
      party: { select: { name: true } },
      items: { select: { quantity: true, rate: true, taxableAmount: true, cgstAmount: true, sgstAmount: true, igstAmount: true } },
    },
  });

  const returnedShipments = creditNotes.map(cn => ({
    id:          cn.id,
    invoiceNo:   cn.invoiceNo,
    partyName:   cn.party.name,
    date:        cn.invoiceDate?.toISOString().split("T")[0] ?? cn.createdAt.toISOString().split("T")[0],
    amount:      cn.totalAmount != null ? roundMoney(Number(cn.totalAmount)) : getPurchaseBillAmount(cn.items),
  }));

  // ── 8. Top Purchase Parties ──────────────────────────────────────────────────
  const topPartiesRaw = await prisma.purchaseBill.groupBy({
    by: ["partyId"],
    where: { documentType: PurchaseDocumentType.BILL },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  const tpIds   = topPartiesRaw.map(r => r.partyId);
  const tpInfo  = await prisma.party.findMany({ where: { id: { in: tpIds } }, select: { id: true, name: true } });
  const tpMap   = Object.fromEntries(tpInfo.map(p => [p.id, p.name]));

  // Get total amounts per party
  const partyAmts = await prisma.$queryRaw<{ partyId: string; totalAmt: number }[]>`
    SELECT "partyId", SUM(COALESCE("totalAmount", 0))::float AS "totalAmt"
    FROM "PurchaseBill"
    WHERE "documentType" = 'BILL'
    GROUP BY "partyId"
    ORDER BY "totalAmt" DESC
    LIMIT 10
  `;
  const partyAmtMap = Object.fromEntries(partyAmts.map(r => [r.partyId, roundMoney(Number(r.totalAmt))]));

  const topPurchaseParties = topPartiesRaw.map(r => ({
    partyId:       r.partyId,
    partyName:     tpMap[r.partyId] ?? r.partyId,
    billCount:     r._count.id,
    totalPurchase: partyAmtMap[r.partyId] ?? 0,
  })).sort((a, b) => b.totalPurchase - a.totalPurchase);

  // ── 9. Top Team Workers (by orders generated) ────────────────────────────────
  const workerRaw = await prisma.orderInitiation.groupBy({
    by: ["filledByUserId"],
    where: { filledByUserId: { not: null }, source: "SALES" },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  const workerIds  = workerRaw.map(r => r.filledByUserId!).filter(Boolean);
  const workerInfo = await prisma.user.findMany({
    where: { id: { in: workerIds } },
    select: { id: true, name: true, role: true },
  });
  const workerMap  = Object.fromEntries(workerInfo.map(u => [u.id, u]));

  const topWorkers = workerRaw
    .filter(r => r.filledByUserId)
    .map(r => ({
      userId:     r.filledByUserId!,
      userName:   workerMap[r.filledByUserId!]?.name ?? "Unknown",
      role:       workerMap[r.filledByUserId!]?.role ?? "—",
      orderCount: r._count.id,
    }));

  return NextResponse.json({
    kpis: {
      totalOrders,
      dispatchedCount: dispatchedOrders.length,
      totalRevenue:    roundMoney(totalRevenue),
      totalProducts,
      totalParties,
      pendingBillCount: pendingPayments.length,
      totalPendingAmount,
    },
    topProducts,
    bestSellers,
    countrySales,
    monthlyRevenue,
    pendingPayments,
    returnedShipments,
    topPurchaseParties,
    topWorkers,
  });
}
