import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      composition: true,
      manufacturer: true,
      pack: true,
      mrp: true,
      minMargin: true,
      maxMargin: true,
      group: { select: { id: true, name: true } },
    },
  });

  // Group-level default margins (read via raw SQL — columns added by migration)
  const grpRows = await prisma.$queryRawUnsafe<{ id: string; dmin: number | null; dmax: number | null }[]>(
    `SELECT id, "defaultMinMargin" AS dmin, "defaultMaxMargin" AS dmax FROM "ProductGroup"`
  );
  const grpDefaults = new Map(grpRows.map((g) => [g.id, { dmin: g.dmin, dmax: g.dmax }]));

  const priceList = products.map((p) => {
    const mrp = p.mrp ?? null;
    const gd  = p.group ? grpDefaults.get(p.group.id) : undefined;

    // Resolution: per-product override → group default → none
    const effMin = p.minMargin ?? gd?.dmin ?? null;
    const effMax = p.maxMargin ?? gd?.dmax ?? null;

    const minPrice =
      mrp != null && effMin != null ? parseFloat((mrp * (1 + effMin / 100)).toFixed(2))
      : mrp != null ? mrp : null;
    const maxPrice =
      mrp != null && effMax != null ? parseFloat((mrp * (1 + effMax / 100)).toFixed(2))
      : mrp != null ? mrp : null;

    return {
      id: p.id,
      name: p.name,
      composition: p.composition,
      manufacturer: p.manufacturer,
      pack: p.pack,
      group: p.group?.name ?? null,
      minPrice,
      maxPrice,
      hasMargins: effMin != null || effMax != null,
      isOverride: p.minMargin != null || p.maxMargin != null,
    };
  });

  return NextResponse.json(priceList);
}
