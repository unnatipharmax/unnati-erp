// GET /api/purchase-bills-report?from=YYYY-MM-DD&to=YYYY-MM-DD[&type=credit_note]
// Returns purchase bills (type BILL) or credit notes (type=credit_note) in the date range.

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
  const type = searchParams.get("type"); // "credit_note" or null (bills)

  const isCreditNote = type === "credit_note";
  const docType = isCreditNote ? PurchaseDocumentType.CREDIT_NOTE : PurchaseDocumentType.BILL;

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
      documentType: docType,
      party: { isActive: true },
      ...dateFilter,
    },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
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
      // For credit notes: how much has been applied against bills
      creditNoteAllocations: isCreditNote
        ? { select: { amount: true } }
        : false,
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

    // For credit notes: applied = how much of this CN has been used against bills
    const applied = isCreditNote && (bill as any).creditNoteAllocations
      ? roundMoney((bill as any).creditNoteAllocations.reduce((s: number, a: any) => s + Number(a.amount), 0))
      : 0;
    const remaining = isCreditNote ? Math.max(0, roundMoney(billAmount - applied)) : 0;

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
      applied,
      remaining,
    };
  });

  const totalBillAmount     = roundMoney(rows.reduce((s, r) => s + r.billAmount,     0));
  const totalPaid           = roundMoney(rows.reduce((s, r) => s + r.paidAmount,     0));
  const totalCreditAdjusted = roundMoney(rows.reduce((s, r) => s + r.creditAdjusted, 0));
  const totalOutstanding    = roundMoney(rows.reduce((s, r) => s + r.outstanding,    0));
  const totalApplied        = roundMoney(rows.reduce((s, r) => s + r.applied,        0));
  const totalRemaining      = roundMoney(rows.reduce((s, r) => s + r.remaining,      0));

  return NextResponse.json({
    rows,
    summary: {
      billCount:          rows.length,
      totalBillAmount,
      totalPaid,
      totalCreditAdjusted,
      totalOutstanding,
      totalApplied,
      totalRemaining,
    },
  });
}
