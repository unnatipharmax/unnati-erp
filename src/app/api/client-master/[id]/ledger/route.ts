// GET /api/client-master/[id]/ledger
// Returns the client's AccountLedger entries + orders as a combined ledger view

import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { getSession } from "../../../../../lib/auth";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const account = await prisma.clientAccount.findUnique({
    where:   { id },
    include: { phones: true, emails: true },
  });

  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch all ledger entries (balance credits/debits)
  const ledgerEntries = await prisma.accountLedger.findMany({
    where:   { accountId: id },
    orderBy: { createdAt: "asc" },
  });

  // Fetch all orders linked to this account
  const orders = await prisma.orderInitiation.findMany({
    where:   { accountId: id },
    orderBy: { createdAt: "asc" },
    include: {
      orderEntry: {
        include: { items: { include: { product: true } } },
      },
    },
  });

  // Build combined timeline entries
  type Entry = {
    id: string;
    date: string;
    kind: "credit" | "debit" | "order";
    particulars: string;
    credit: number | null;
    debit: number | null;
    balance: number;
    note: string | null;
    // order-specific
    orderStatus?: string;
    invoiceNo?: string | null;
    fullName?: string;
    city?: string;
    country?: string;
  };

  const raw: { date: Date; entry: Entry }[] = [];

  for (const l of ledgerEntries) {
    const amount = parseFloat(l.amount.toString());
    raw.push({
      date: l.createdAt,
      entry: {
        id:          l.id,
        date:        l.createdAt.toISOString(),
        kind:        l.type === "CREDIT" ? "credit" : "debit",
        particulars: l.note ?? (l.type === "CREDIT" ? "Balance Credit" : "Balance Debit"),
        credit:      l.type === "CREDIT" ? amount : null,
        debit:       l.type === "DEBIT"  ? amount : null,
        balance:     0, // computed below
        note:        l.note,
      },
    });
  }

  for (const o of orders) {
    const amount = parseFloat(o.amountPaid.toString());
    raw.push({
      date: o.createdAt,
      entry: {
        id:          o.id,
        date:        o.createdAt.toISOString(),
        kind:        "order",
        particulars: `Order — ${o.fullName}`,
        credit:      null,
        debit:       amount,
        balance:     0,
        note:        null,
        orderStatus: o.status,
        invoiceNo:   o.invoiceNo,
        fullName:    o.fullName,
        city:        o.city,
        country:     o.country,
      },
    });
  }

  // Sort by date ascending, then compute running balance
  raw.sort((a, b) => a.date.getTime() - b.date.getTime());

  let running = 0;
  const entries: Entry[] = raw.map(({ entry }) => {
    if (entry.credit != null) running += entry.credit;
    if (entry.debit  != null) running -= entry.debit;
    return { ...entry, balance: running };
  });

  // Summary
  const totalCredit  = entries.reduce((s, e) => s + (e.credit  ?? 0), 0);
  const totalDebit   = entries.reduce((s, e) => s + (e.debit   ?? 0), 0);
  const orderCount   = orders.length;
  const closingBal   = parseFloat(account.balance.toString());

  return NextResponse.json({
    client: {
      id:               account.id,
      name:             account.name,
      address:          account.address,
      gstNumber:        account.gstNumber,
      drugLicenseNumber: account.drugLicenseNumber,
      phone:            account.phones[0]?.phone ?? null,
      email:            account.emails[0]?.email ?? null,
      balance:          closingBal,
    },
    entries,
    summary: {
      orderCount,
      totalCredit,
      totalDebit,
      closingBalance: closingBal,
    },
  });
}
