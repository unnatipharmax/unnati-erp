import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { getSession } from "../../../../../lib/auth";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const url     = new URL(req.url);

  // Default date range: current financial year (Apr 1 → Mar 31)
  const now = new Date();
  const fyStart = now.getMonth() >= 3
    ? new Date(now.getFullYear(), 3, 1)          // Apr 1 this year
    : new Date(now.getFullYear() - 1, 3, 1);     // Apr 1 last year
  const fyEnd = new Date(fyStart.getFullYear() + 1, 2, 31, 23, 59, 59);

  const fromParam = url.searchParams.get("from");
  const toParam   = url.searchParams.get("to");
  const from = fromParam ? new Date(fromParam) : fyStart;
  const to   = toParam   ? new Date(toParam + "T23:59:59") : fyEnd;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true, name: true, composition: true,
      manufacturer: true, pack: true, mrp: true, hsn: true,
    },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── Purchases (RECEIVE) ──────────────────────────────────────────────────────
  const allPurchases = await prisma.purchaseItem.findMany({
    where: { productId: id },
    select: {
      id: true, quantity: true, rate: true,
      purchase: {
        select: {
          id: true, invoiceNo: true, invoiceDate: true, createdAt: true,
          party: { select: { name: true } },
        },
      },
    },
  });

  // ── Sales (ISSUE) ────────────────────────────────────────────────────────────
  const allSales = await prisma.orderEntryItem.findMany({
    where: { productId: id },
    select: {
      id: true, quantity: true, sellingPrice: true,
      orderEntry: {
        select: {
          order: {
            select: {
              id: true, invoiceNo: true, invoiceGeneratedAt: true, createdAt: true,
              fullName: true, status: true,
            },
          },
        },
      },
    },
  });

  // ── Build typed entries ──────────────────────────────────────────────────────
  type Entry = {
    id: string;
    date: Date;
    billNo: string;
    particulars: string;
    type: "purchase" | "sale";
    quantity: number;
    rate: number;
    amount: number;
  };

  const allEntries: Entry[] = [
    ...allPurchases.map(p => ({
      id:          p.id,
      date:        p.purchase.invoiceDate ?? p.purchase.createdAt,
      billNo:      p.purchase.invoiceNo ?? p.purchase.id.slice(0, 8).toUpperCase(),
      particulars: p.purchase.party.name,
      type:        "purchase" as const,
      quantity:    p.quantity,
      rate:        Number(p.rate),
      amount:      Number(p.rate) * p.quantity,
    })),
    ...allSales
      .filter(s => s.orderEntry.order.status !== "INITIATED")
      .map(s => ({
        id:          s.id,
        date:        s.orderEntry.order.invoiceGeneratedAt ?? s.orderEntry.order.createdAt,
        billNo:      s.orderEntry.order.invoiceNo ?? s.orderEntry.order.id.slice(0, 8).toUpperCase(),
        particulars: s.orderEntry.order.fullName,
        type:        "sale" as const,
        quantity:    s.quantity,
        rate:        Number(s.sellingPrice),
        amount:      Number(s.sellingPrice) * s.quantity,
      })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  // ── Opening balance = transactions before `from` ────────────────────────────
  const beforeFrom = allEntries.filter(e => e.date < from);
  const openingQty  = beforeFrom.reduce((s, e) => s + (e.type === "purchase" ? e.quantity : -e.quantity), 0);
  const openingVal  = beforeFrom.reduce((s, e) => s + (e.type === "purchase" ? e.amount : -e.amount), 0);

  // ── Entries in range ─────────────────────────────────────────────────────────
  const inRange = allEntries.filter(e => e.date >= from && e.date <= to);

  let balance = openingQty;
  const entries = inRange.map(e => {
    if (e.type === "purchase") balance += e.quantity;
    else balance -= e.quantity;
    return {
      id:          e.id,
      date:        e.date.toISOString().split("T")[0],
      billNo:      e.billNo,
      particulars: e.particulars,
      type:        e.type,
      receive:     e.type === "purchase" ? e.quantity : null,
      issue:       e.type === "sale"     ? e.quantity : null,
      balance,
      rate:        e.rate,
      amount:      e.amount,
    };
  });

  // ── Summary ──────────────────────────────────────────────────────────────────
  const totalReceiveQty = inRange.filter(e => e.type === "purchase").reduce((s, e) => s + e.quantity, 0);
  const totalReceiveVal = inRange.filter(e => e.type === "purchase").reduce((s, e) => s + e.amount, 0);
  const totalIssueQty   = inRange.filter(e => e.type === "sale").reduce((s, e) => s + e.quantity, 0);
  const totalIssueVal   = inRange.filter(e => e.type === "sale").reduce((s, e) => s + e.amount, 0);
  const closingQty      = openingQty + totalReceiveQty - totalIssueQty;
  const closingVal      = openingVal + totalReceiveVal - totalIssueVal;

  return NextResponse.json({
    product,
    from: from.toISOString().split("T")[0],
    to:   to.toISOString().split("T")[0],
    entries,
    summary: {
      openingQty, openingVal,
      totalReceiveQty, totalReceiveVal,
      totalIssueQty,   totalIssueVal,
      closingQty,      closingVal,
    },
  });
}
