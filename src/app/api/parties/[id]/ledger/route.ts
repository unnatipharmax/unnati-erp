import { PurchaseDocumentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import {
  getCreditNoteAmount,
  getPurchaseBillAmount,
  roundMoney,
} from "../../../../../lib/purchaseAccounting";
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

  const party = await prisma.party.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      address: true,
      gstNumber: true,
      drugLicenseNumber: true,
      phones: { select: { phone: true } },
      emails: { select: { email: true } },
    },
  });

  if (!party) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const documents = await prisma.purchaseBill.findMany({
    where: { partyId: id },
    orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      invoiceNo: true,
      invoiceDate: true,
      createdAt: true,
      documentType: true,
      totalAmount: true,
      items: {
        select: {
          id: true,
          quantity: true,
          rate: true,
          discount: true,
          mrp: true,
          gstPercent: true,
          taxableAmount: true,
          cgstPercent: true,
          sgstPercent: true,
          igstPercent: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          batch: true,
          expiry: true,
          product: {
            select: {
              id: true,
              name: true,
              composition: true,
              pack: true,
            },
          },
        },
      },
      creditNoteAllocations: {
        select: {
          id: true,
          amount: true,
          bill: { select: { id: true, invoiceNo: true } },
        },
      },
    },
  });

  const payments = await prisma.partyPayment.findMany({
    where: { partyId: id },
    orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      amount: true,
      paymentDate: true,
      mode: true,
      reference: true,
      notes: true,
      createdAt: true,
      allocations: {
        select: {
          id: true,
          amount: true,
          bill: { select: { id: true, invoiceNo: true } },
        },
      },
    },
  });

  type RawEntry =
    | { kind: "bill"; date: Date; data: typeof documents[number] }
    | { kind: "creditNote"; date: Date; data: typeof documents[number] }
    | { kind: "payment"; date: Date; data: typeof payments[number] };

  const rawEntries: RawEntry[] = [
    ...documents.map((document) => ({
      kind: document.documentType === PurchaseDocumentType.CREDIT_NOTE ? "creditNote" as const : "bill" as const,
      date: document.invoiceDate ?? document.createdAt,
      data: document,
    })),
    ...payments.map((payment) => ({
      kind: "payment" as const,
      date: payment.paymentDate,
      data: payment,
    })),
  ].sort((left, right) => left.date.getTime() - right.date.getTime());

  let totalCredit = 0;
  let totalDebit = 0;

  const entries = rawEntries.map((entry) => {
    if (entry.kind === "bill" || entry.kind === "creditNote") {
      const document = entry.data;
      const amount = document.totalAmount != null
        ? roundMoney(Number(document.totalAmount))
        : entry.kind === "creditNote"
          ? getCreditNoteAmount(document.items)
          : getPurchaseBillAmount(document.items);

      const itemDetails = document.items.map((item) => ({
        id: item.id,
        productId: item.product.id,
        productName: item.product.name,
        composition: item.product.composition,
        pack: item.product.pack,
        batch: item.batch,
        expiry: item.expiry,
        quantity: item.quantity,
        rate: Number(item.rate),
        mrp: item.mrp != null ? Number(item.mrp) : null,
        discount: item.discount != null ? Number(item.discount) : null,
        gstPercent: item.gstPercent != null ? Number(item.gstPercent) : null,
        taxableAmount: item.taxableAmount != null ? Number(item.taxableAmount) : null,
        cgstPercent: item.cgstPercent != null ? Number(item.cgstPercent) : null,
        sgstPercent: item.sgstPercent != null ? Number(item.sgstPercent) : null,
        igstPercent: item.igstPercent != null ? Number(item.igstPercent) : null,
        cgstAmount: item.cgstAmount != null ? Number(item.cgstAmount) : null,
        sgstAmount: item.sgstAmount != null ? Number(item.sgstAmount) : null,
        igstAmount: item.igstAmount != null ? Number(item.igstAmount) : null,
      }));

      const allocations = entry.kind === "creditNote"
        ? document.creditNoteAllocations.map((allocation) => ({
            id: allocation.id,
            amount: Number(allocation.amount),
            billId: allocation.bill?.id ?? null,
            invoiceNo: allocation.bill?.invoiceNo ?? null,
          }))
        : [];

      if (entry.kind === "creditNote") {
        totalDebit += amount;
      } else {
        totalCredit += amount;
      }

      const balance = roundMoney(totalCredit - totalDebit);
      const productNames = itemDetails.map((item) => item.productName).join(", ");

      return {
        id: document.id,
        kind: entry.kind,
        date: entry.date.toISOString().split("T")[0],
        particulars: productNames || (entry.kind === "creditNote" ? "Purchase Return" : "Purchase"),
        vchType: entry.kind === "creditNote" ? "Credit Note" : "Purchase",
        vchNo: document.invoiceNo ?? null,
        debit: entry.kind === "creditNote" ? amount : null,
        credit: entry.kind === "bill" ? amount : null,
        balance,
        balanceType: balance >= 0 ? "Cr" : "Dr",
        invoiceNo: document.invoiceNo,
        invoiceDate: document.invoiceDate ? document.invoiceDate.toISOString().split("T")[0] : null,
        itemCount: itemDetails.length,
        items: itemDetails,
        mode: null,
        reference: null,
        notes: entry.kind === "creditNote"
          ? "Return value excludes bill discount during adjustment."
          : null,
        allocations,
      };
    }

    totalDebit += Number(entry.data.amount);
    const balance = roundMoney(totalCredit - totalDebit);
    const allocations = entry.data.allocations.map((allocation) => ({
      id: allocation.id,
      amount: Number(allocation.amount),
      billId: allocation.bill?.id ?? null,
      invoiceNo: allocation.bill?.invoiceNo ?? null,
    }));
    const allocationText = allocations.length > 0
      ? allocations
          .map((allocation) => allocation.invoiceNo ? `Agst. ${allocation.invoiceNo}` : "On Account")
          .join(", ")
      : "On Account";

    return {
      id: entry.data.id,
      kind: "payment" as const,
      date: entry.date.toISOString().split("T")[0],
      particulars: [entry.data.mode ?? "Payment", allocationText, entry.data.notes].filter(Boolean).join(" - "),
      vchType: "Payment",
      vchNo: entry.data.reference ?? null,
      debit: Number(entry.data.amount),
      credit: null,
      balance,
      balanceType: balance >= 0 ? "Cr" : "Dr",
      invoiceNo: null,
      invoiceDate: null,
      itemCount: 0,
      items: [],
      mode: entry.data.mode,
      reference: entry.data.reference,
      notes: entry.data.notes,
      allocations,
    };
  });

  const creditNoteCount = documents.filter(
    (document) => document.documentType === PurchaseDocumentType.CREDIT_NOTE
  ).length;
  const billCount = documents.length - creditNoteCount;
  const finalBalance = roundMoney(totalCredit - totalDebit);

  return NextResponse.json({
    party: {
      id: party.id,
      name: party.name,
      address: party.address,
      gstNumber: party.gstNumber,
      drugLicenseNumber: party.drugLicenseNumber,
      phone: party.phones[0]?.phone ?? null,
      email: party.emails[0]?.email ?? null,
    },
    entries,
    summary: {
      billCount,
      paymentCount: payments.length,
      creditNoteCount,
      totalCredit,
      totalDebit,
      totalCreditNotes: roundMoney(
        entries
          .filter((ledgerEntry) => ledgerEntry.kind === "creditNote")
          .reduce((sum, ledgerEntry) => sum + Number(ledgerEntry.debit ?? 0), 0)
      ),
      closingBalance: finalBalance,
      balanceType: finalBalance >= 0 ? "Cr" : "Dr",
    },
  });
}
