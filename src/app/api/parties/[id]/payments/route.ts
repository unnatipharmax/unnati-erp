import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { getSession } from "../../../../../lib/auth";

export const runtime = "nodejs";

// GET — return bills with outstanding balances for invoice selection
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Fetch bills; include allocations only if table exists
  let bills: any[] = [];
  try {
    bills = await (prisma as any).purchaseBill.findMany({
      where: { partyId: id },
      orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, invoiceNo: true, invoiceDate: true,
        totalAmount: true, createdAt: true,
        items: {
          select: {
            taxableAmount: true, rate: true, quantity: true,
            cgstAmount: true, sgstAmount: true, igstAmount: true,
          },
        },
        allocations: { select: { amount: true } },
      },
    });
  } catch {
    // Fallback without allocations if PartyPaymentAllocation table doesn't exist yet
    bills = await prisma.purchaseBill.findMany({
      where: { partyId: id },
      orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, invoiceNo: true, invoiceDate: true,
        totalAmount: true, createdAt: true,
        items: {
          select: {
            taxableAmount: true, rate: true, quantity: true,
            cgstAmount: true, sgstAmount: true, igstAmount: true,
          },
        },
      },
    });
  }

  const billsWithBalance = bills.map(b => {
    const itemsTotal = (b.items as any[]).reduce((s: number, i: any) => {
      const base = i.taxableAmount != null ? Number(i.taxableAmount) : i.rate * i.quantity;
      const gst  = (i.cgstAmount ? Number(i.cgstAmount) : 0)
                 + (i.sgstAmount ? Number(i.sgstAmount) : 0)
                 + (i.igstAmount ? Number(i.igstAmount) : 0);
      return s + base + gst;
    }, 0);
    const billAmount  = b.totalAmount ? Number(b.totalAmount) : itemsTotal;
    const paidAmount  = (b.allocations as any[]).reduce((s: number, a: any) => s + Number(a.amount), 0);
    const outstanding = Math.max(0, billAmount - paidAmount);

    return {
      id:          b.id,
      invoiceNo:   b.invoiceNo,
      invoiceDate: b.invoiceDate ? b.invoiceDate.toISOString().split("T")[0] : null,
      createdAt:   b.createdAt.toISOString(),
      billAmount,
      paidAmount,
      outstanding,
    };
  });

  return NextResponse.json({ bills: billsWithBalance });
}

// POST — create a payment with multi-invoice allocations
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { amount, paymentDate, mode, reference, notes, allocations } = body;
  // allocations = [{ billId, amount }, ...]

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
    return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });

  const totalAllocated = (allocations ?? []).reduce((s: number, a: any) => s + Number(a.amount), 0);
  if (totalAllocated > Number(amount) + 0.01)
    return NextResponse.json({ error: "Allocated amount exceeds payment amount" }, { status: 400 });

  const paymentId = crypto.randomUUID();

  // Insert payment header
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO "PartyPayment" ("id","partyId","amount","paymentDate","mode","reference","notes","createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
    paymentId, id, Number(amount),
    paymentDate ? new Date(paymentDate) : new Date(),
    mode || null, reference || null, notes || null
  );

  // Insert allocations
  if (allocations && allocations.length > 0) {
    for (const alloc of allocations) {
      if (!alloc.billId || !alloc.amount || Number(alloc.amount) <= 0) continue;
      await (prisma as any).$executeRawUnsafe(
        `INSERT INTO "PartyPaymentAllocation" ("id","paymentId","billId","amount","createdAt")
         VALUES ($1,$2,$3,$4,NOW())`,
        crypto.randomUUID(), paymentId, alloc.billId, Number(alloc.amount)
      );
    }
  }

  return NextResponse.json({ success: true, paymentId });
}
