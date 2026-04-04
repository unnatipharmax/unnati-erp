// GET /api/purchase-bills-report?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns all credit purchase bills (type BILL) in the date range
// with bill amount, paid amount, credit note adjustments, and outstanding balance.

import { NextResponse } from "next/server";
import { PurchaseDocumentType } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/auth";
import { getPurchaseBillAmount, roundMoney } from "../../../lib/purchaseAccounting";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  // Build date filter — apply to invoiceDate; fall back to createdAt if null
  const dateFilter = from && to
    ? {
        OR: [
          { invoiceDate: { gte: new Date(from), lte: new Date(to + "T23:59:59.999Z") } },
          { invoiceDate: null, createdAt: { gte: new Date(from), lte: new Date(to + "T23:59:59.999Z") } },
        ],
      }
    : {};

  const bills = await prisma.purchaseBill.findMany({
    where: {
      documentType: PurchaseDocumentType.BILL,
      party: { isActive: true },
      ...dateFilter,
    },
    orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
    select: {
      id:          true,
      invoiceNo:   true,
      invoiceDate: true,
      createdAt:   true,
      totalAmount: true,
      party: {
        select: { id: true, name: true, gstNumber: true },
      },
      items: {
        select: {
          quantity:      true,
          rate:          true,
          taxableAmount: true,
          cgstAmount:    true,
          sgstAmount:    true,
          igstAmount:    true,
          product: { select: { name: true } },
        },
      },
      allocations: {
        select: { amount: true },
      },
      adjustedByCreditNotes: {
        select: { amount: true },
      },
    },
  });

  const rows = bills.map(bill => {
    const billAmount       = bill.totalAmount != null
      ? roundMoney(Number(bill.totalAmount))
      : getPurchaseBillAmount(bill.items);
    const paidAmount       = roundMoney(bill.allocations.reduce((s, a) => s + Number(a.amount), 0));
    const creditAdjusted   = roundMoney(bill.adjustedByCreditNotes.reduce((s, a) => s + Number(a.amount), 0));
    const outstanding      = Math.max(0, roundMoney(billAmount - paidAmount - creditAdjusted));
    const products         = bill.items.map(i => i.product.name).join(", ");

    return {
      id:            bill.id,
      invoiceNo:     bill.invoiceNo,
      invoiceDate:   bill.invoiceDate ? bill.invoiceDate.toISOString().split("T")[0] : null,
      createdAt:     bill.createdAt.toISOString().split("T")[0],
      partyId:       bill.party.id,
      partyName:     bill.party.name,
      partyGst:      bill.party.gstNumber,
      products,
      billAmount,
      paidAmount,
      creditAdjusted,
      outstanding,
    };
  });

  const totalBillAmount     = roundMoney(rows.reduce((s, r) => s + r.billAmount,     0));
  const totalPaid           = roundMoney(rows.reduce((s, r) => s + r.paidAmount,     0));
  const totalCreditAdjusted = roundMoney(rows.reduce((s, r) => s + r.creditAdjusted, 0));
  const totalOutstanding    = roundMoney(rows.reduce((s, r) => s + r.outstanding,    0));

  return NextResponse.json({
    rows,
    summary: {
      billCount:          rows.length,
      totalBillAmount,
      totalPaid,
      totalCreditAdjusted,
      totalOutstanding,
    },
  });
}
