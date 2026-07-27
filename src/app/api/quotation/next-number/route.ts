// POST /api/quotation/next-number
// Atomically increments the active company's quote sequence and returns the next
// quote number (e.g. "Q-001"). Called when the user prints/downloads a quote, so
// numbers only advance on a real quote — not on page load. Per-company sequence.
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";
import { getActiveCompanyId } from "../../../../lib/company";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "SALES"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const companyId = await getActiveCompanyId();

  try {
    const seq = await prisma.quoteSequence.upsert({
      where:  { companyId },
      create: { companyId, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    const quoteNo = `Q-${String(seq.lastNumber).padStart(3, "0")}`;
    return NextResponse.json({ quoteNo, number: seq.lastNumber });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
