import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { getSession } from "../../../../../lib/auth";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  // Build ledger entries with running total
  let runningTotal = 0;
  const entries = bills.map(b => {
    const itemsTotal = b.items.reduce((s, i) => {
      const base = i.taxableAmount ?? (i.rate * i.quantity);
      const gst  = (i.cgstAmount ?? 0) + (i.sgstAmount ?? 0) + (i.igstAmount ?? 0);
      return s + base + gst;
    }, 0);
    const amount = b.totalAmount ? Number(b.totalAmount) : itemsTotal;
    runningTotal += amount;

    return {
      id:          b.id,
      invoiceNo:   b.invoiceNo,
      invoiceDate: b.invoiceDate ? b.invoiceDate.toISOString().split("T")[0] : null,
      createdAt:   b.createdAt.toISOString(),
      totalAmount: amount,
      runningTotal,
      itemCount:   b.items.length,
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
        mrp:          i.mrp     ? Number(i.mrp)          : null,
        discount:     i.discount ? Number(i.discount)    : null,
        gstPercent:   i.gstPercent   ? Number(i.gstPercent)   : null,
        cgstPercent:  i.cgstPercent  ? Number(i.cgstPercent)  : null,
        sgstPercent:  i.sgstPercent  ? Number(i.sgstPercent)  : null,
        igstPercent:  i.igstPercent  ? Number(i.igstPercent)  : null,
        taxableAmount: i.taxableAmount ? Number(i.taxableAmount) : null,
        cgstAmount:   i.cgstAmount  ? Number(i.cgstAmount)  : null,
        sgstAmount:   i.sgstAmount  ? Number(i.sgstAmount)  : null,
        igstAmount:   i.igstAmount  ? Number(i.igstAmount)  : null,
      })),
    };
  });

  return NextResponse.json({
    party: {
      id:               party.id,
      name:             party.name,
      address:          party.address,
      gstNumber:        party.gstNumber,
      drugLicenseNumber: party.drugLicenseNumber,
      phone:            party.phones[0]?.phone ?? null,
      email:            party.emails[0]?.email ?? null,
    },
    entries,
    summary: {
      billCount:    entries.length,
      totalPurchased: runningTotal,
    },
  });
}
