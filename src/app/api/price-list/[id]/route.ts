import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

const round = (n: number, d = 4) => parseFloat(n.toFixed(d));
const round2 = (n: number) => parseFloat(n.toFixed(2));

// PATCH /api/price-list/[id] — admin/manager edit Min/Max selling price directly.
// Stored as MRP + margins (no schema change): margins are back-calculated against
// the product's MRP; if MRP is absent it is seeded from the entered price so the
// values round-trip exactly through the price-list formula.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const minP = body.minPrice != null && body.minPrice !== "" ? Number(body.minPrice) : null;
  const maxP = body.maxPrice != null && body.maxPrice !== "" ? Number(body.maxPrice) : null;

  if (minP == null && maxP == null)
    return NextResponse.json({ error: "Enter a min or max price" }, { status: 400 });
  if ((minP != null && (isNaN(minP) || minP < 0)) || (maxP != null && (isNaN(maxP) || maxP < 0)))
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });

  const product = await prisma.product.findUnique({
    where: { id },
    select: { mrp: true, minMargin: true, maxMargin: true },
  });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // Base for margin math: existing MRP, else the max (or min) price entered.
  let base = product.mrp && product.mrp > 0 ? product.mrp : (maxP ?? minP ?? 0);
  if (!base || base <= 0)
    return NextResponse.json({ error: "Enter a max price to set the base" }, { status: 400 });

  const data: { mrp?: number; minMargin?: number; maxMargin?: number } = {};
  if (!(product.mrp && product.mrp > 0)) data.mrp = round2(base);
  if (maxP != null) data.maxMargin = round((maxP / base - 1) * 100);
  if (minP != null) data.minMargin = round((minP / base - 1) * 100);

  await prisma.product.update({ where: { id }, data });

  // Recompute resulting prices for the UI
  const effMrp     = data.mrp ?? product.mrp!;
  const effMinMarg = data.minMargin ?? product.minMargin;
  const effMaxMarg = data.maxMargin ?? product.maxMargin;
  const minPrice = effMinMarg != null ? round2(effMrp * (1 + effMinMarg / 100)) : effMrp;
  const maxPrice = effMaxMarg != null ? round2(effMrp * (1 + effMaxMarg / 100)) : effMrp;

  return NextResponse.json({ ok: true, minPrice, maxPrice });
}
