// PATCH /api/packaging/orders/[orderId]/weight
// Persist net / gross weight (kg) for an order during the In-Packing stage.
// Body: { netWeight?: number|null, grossWeight?: number|null }
import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { getSession } from "../../../../../../lib/auth";
import { getActiveCompanyId } from "../../../../../../lib/company";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "PACKAGING"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { orderId } = await ctx.params;
  const companyId = await getActiveCompanyId();

  // Only touch an order that belongs to the active company
  const order = await prisma.orderInitiation.findFirst({
    where: { id: orderId, companyId },
    select: { id: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const body = await req.json();
  const net   = body.netWeight;
  const gross = body.grossWeight;

  const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // Update whichever weight was provided (undefined = leave unchanged)
  if (net !== undefined) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "OrderInitiation" SET "netWeight" = $1 WHERE id = $2`,
        toNum(net), orderId,
      );
    } catch { /* column may not exist yet */ }
  }
  if (gross !== undefined) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "OrderInitiation" SET "grossWeight" = $1 WHERE id = $2`,
        toNum(gross), orderId,
      );
    } catch { /* column may not exist yet */ }
  }

  return NextResponse.json({ ok: true, netWeight: toNum(net), grossWeight: toNum(gross) });
}
