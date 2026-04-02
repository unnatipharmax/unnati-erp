import { PurchaseDocumentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import { getPurchaseBillAmount, roundMoney } from "../../../../../lib/purchaseAccounting";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const bills = await prisma.purchaseBill.findMany({
    where: {
      partyId: id,
      documentType: PurchaseDocumentType.BILL,
    },
    orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      invoiceNo: true,
      invoiceDate: true,
      totalAmount: true,
      createdAt: true,
      items: {
        select: {
          quantity: true,
          rate: true,
          taxableAmount: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
        },
      },
      allocations: { select: { amount: true } },
      adjustedByCreditNotes: { select: { amount: true } },
    },
  });

  const billsWithBalance = bills.map((bill) => {
    const billAmount = bill.totalAmount != null
      ? roundMoney(Number(bill.totalAmount))
      : getPurchaseBillAmount(bill.items);
    const paidAmount = roundMoney(
      bill.allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0)
    );
    const creditNoteAdjusted = roundMoney(
      bill.adjustedByCreditNotes.reduce((sum, allocation) => sum + Number(allocation.amount), 0)
    );
    const outstanding = Math.max(0, roundMoney(billAmount - paidAmount - creditNoteAdjusted));

    return {
      id: bill.id,
      invoiceNo: bill.invoiceNo,
      invoiceDate: bill.invoiceDate ? bill.invoiceDate.toISOString().split("T")[0] : null,
      createdAt: bill.createdAt.toISOString(),
      billAmount,
      paidAmount,
      creditNoteAdjusted,
      outstanding,
    };
  });

  return NextResponse.json({ bills: billsWithBalance });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { amount, paymentDate, mode, reference, notes, allocations } = body;

  if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
  }

  const normalizedAllocations = (allocations ?? [])
    .map((allocation: any) => ({
      billId: allocation.billId,
      amount: roundMoney(Number(allocation.amount)),
    }))
    .filter((allocation: { billId?: string; amount: number }) => allocation.billId && allocation.amount > 0);

  const totalAllocated = roundMoney(
    normalizedAllocations.reduce((sum: number, allocation: { amount: number }) => sum + allocation.amount, 0)
  );

  if (totalAllocated > Number(amount) + 0.01) {
    return NextResponse.json({ error: "Allocated amount exceeds payment amount" }, { status: 400 });
  }

  if (normalizedAllocations.length > 0) {
    const validBills = await prisma.purchaseBill.findMany({
      where: {
        id: { in: normalizedAllocations.map((allocation: { billId: string }) => allocation.billId) },
        partyId: id,
        documentType: PurchaseDocumentType.BILL,
      },
      select: { id: true },
    });

    if (validBills.length !== normalizedAllocations.length) {
      return NextResponse.json({ error: "One or more selected bills are invalid" }, { status: 400 });
    }
  }

  const payment = await prisma.partyPayment.create({
    data: {
      partyId: id,
      amount: roundMoney(Number(amount)),
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      mode: mode || null,
      reference: reference || null,
      notes: notes || null,
      allocations: normalizedAllocations.length > 0
        ? {
            create: normalizedAllocations.map((allocation: { billId: string; amount: number }) => ({
              billId: allocation.billId,
              amount: allocation.amount,
            })),
          }
        : undefined,
    },
    select: { id: true },
  });

  return NextResponse.json({ success: true, paymentId: payment.id });
}
