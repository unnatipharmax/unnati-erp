import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { getSession } from "../../../../../lib/auth";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const party = await prisma.party.findUnique({
    where: { id },
    select: {
      id: true, name: true, address: true, gstNumber: true,
      drugLicenseNumber: true,
      phones: { select: { phone: true } },
      emails: { select: { email: true } },
    },
  });
  if (!party) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch all purchase bills (Credit side — party billed us)
  const bills = await prisma.purchaseBill.findMany({
    where: { partyId: id },
    orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, invoiceNo: true, invoiceDate: true,
      totalAmount: true, createdAt: true,
      items: {
        select: {
          id: true, quantity: true, rate: true, discount: true,
          mrp: true, gstPercent: true,
          taxableAmount: true,
          cgstPercent: true, sgstPercent: true, igstPercent: true,
          cgstAmount: true, sgstAmount: true, igstAmount: true,
          batch: true, expiry: true,
          product: { select: { id: true, name: true, composition: true, pack: true } },
        },
      },
    },
  });

  // Fetch all payments — wrapped in try/catch in case table doesn't exist yet
  let payments: any[] = [];
  try {
    payments = await (prisma as any).partyPayment.findMany({
      where: { partyId: id },
      orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, amount: true, paymentDate: true,
        mode: true, reference: true, notes: true, createdAt: true,
        allocations: {
          select: {
            id: true, amount: true,
            bill: { select: { id: true, invoiceNo: true } },
          },
        },
      },
    });
  } catch {
    // PartyPayment table not yet created — ledger shows bills only
    payments = [];
  }

  // Merge bills and payments into a single chronological ledger
  type RawEntry =
    | { kind: "bill"; date: Date; data: typeof bills[number] }
    | { kind: "payment"; date: Date; data: typeof payments[number] };

  const raw: RawEntry[] = [
    ...bills.map(b => ({
      kind: "bill" as const,
      date: b.invoiceDate ?? b.createdAt,
      data: b,
    })),
    ...payments.map(p => ({
      kind: "payment" as const,
      date: p.paymentDate,
      data: p,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let totalDebit  = 0; // payments made (Dr — reduces what we owe)
  let totalCredit = 0; // purchase bills (Cr — increases what we owe)

  const entries = raw.map(entry => {
    if (entry.kind === "bill") {
      const b = entry.data;
      const itemsTotal = b.items.reduce((s, i) => {
        const base = i.taxableAmount != null ? Number(i.taxableAmount) : i.rate * i.quantity;
        const gst  = (i.cgstAmount ? Number(i.cgstAmount) : 0)
                   + (i.sgstAmount ? Number(i.sgstAmount) : 0)
                   + (i.igstAmount ? Number(i.igstAmount) : 0);
        return s + base + gst;
      }, 0);
      const amount = b.totalAmount ? Number(b.totalAmount) : itemsTotal;
      totalCredit += amount;
      const balance = totalCredit - totalDebit; // positive = we owe them

      return {
        id:           b.id,
        kind:         "bill" as const,
        date:         entry.date.toISOString().split("T")[0],
        particulars:  b.items.map(i => i.product.name).join(", "),
        vchType:      "Purchase",
        vchNo:        b.invoiceNo ?? null,
        debit:        null,
        credit:       amount,
        balance,
        balanceType:  balance >= 0 ? "Cr" : "Dr",
        // expanded detail
        invoiceNo:    b.invoiceNo,
        invoiceDate:  b.invoiceDate ? b.invoiceDate.toISOString().split("T")[0] : null,
        itemCount:    b.items.length,
        items: b.items.map(i => ({
          id:           i.id,
          productId:    i.product.id,
          productName:  i.product.name,
          composition:  i.product.composition,
          pack:         i.product.pack,
          batch:        i.batch,
          expiry:       i.expiry,
          quantity:     i.quantity,
          rate:         Number(i.rate),
          mrp:          i.mrp          ? Number(i.mrp)          : null,
          discount:     i.discount     ? Number(i.discount)     : null,
          gstPercent:   i.gstPercent   ? Number(i.gstPercent)   : null,
          taxableAmount: i.taxableAmount ? Number(i.taxableAmount) : null,
          cgstPercent:  i.cgstPercent  ? Number(i.cgstPercent)  : null,
          sgstPercent:  i.sgstPercent  ? Number(i.sgstPercent)  : null,
          igstPercent:  i.igstPercent  ? Number(i.igstPercent)  : null,
          cgstAmount:   i.cgstAmount   ? Number(i.cgstAmount)   : null,
          sgstAmount:   i.sgstAmount   ? Number(i.sgstAmount)   : null,
          igstAmount:   i.igstAmount   ? Number(i.igstAmount)   : null,
        })),
      };
    } else {
      const p = entry.data;
      totalDebit += Number(p.amount);
      const balance = totalCredit - totalDebit;

      const allocList = (p.allocations ?? []).map((a: any) => ({
        id:        a.id,
        amount:    Number(a.amount),
        billId:    a.bill?.id ?? null,
        invoiceNo: a.bill?.invoiceNo ?? null,
      }));
      const allocDesc = allocList.length > 0
        ? allocList.map((a: any) => a.invoiceNo ? `Agst. ${a.invoiceNo}` : "On Account").join(", ")
        : "On Account";

      return {
        id:          p.id,
        kind:        "payment" as const,
        date:        entry.date.toISOString().split("T")[0],
        particulars: [p.mode ?? "Payment", allocDesc, p.notes].filter(Boolean).join(" — "),
        vchType:     "Payment",
        vchNo:       p.reference ?? null,
        debit:       Number(p.amount),
        credit:      null,
        balance,
        balanceType: balance >= 0 ? "Cr" : "Dr",
        mode:        p.mode,
        reference:   p.reference,
        notes:       p.notes,
        allocations: allocList,
        items:       [],
        itemCount:   0,
        invoiceNo:   null,
        invoiceDate: null,
      };
    }
  });

  const finalBalance = totalCredit - totalDebit;

  return NextResponse.json({
    party: {
      id: party.id, name: party.name, address: party.address,
      gstNumber: party.gstNumber, drugLicenseNumber: party.drugLicenseNumber,
      phone: party.phones[0]?.phone ?? null,
      email: party.emails[0]?.email ?? null,
    },
    entries,
    summary: {
      billCount:      bills.length,
      paymentCount:   payments.length,
      totalCredit,
      totalDebit,
      closingBalance: finalBalance,
      balanceType:    finalBalance >= 0 ? "Cr" : "Dr",
    },
  });
}
