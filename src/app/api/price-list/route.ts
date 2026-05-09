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
      group: { select: { name: true } },
    },
  });

  const priceList = products.map((p) => {
    const mrp = p.mrp ?? null;
    const minPrice =
      mrp != null && p.minMargin != null
        ? parseFloat((mrp * (1 + p.minMargin / 100)).toFixed(2))
        : mrp != null
        ? mrp
        : null;
    const maxPrice =
      mrp != null && p.maxMargin != null
        ? parseFloat((mrp * (1 + p.maxMargin / 100)).toFixed(2))
        : mrp != null
        ? mrp
        : null;

    return {
      id: p.id,
      name: p.name,
      composition: p.composition,
      manufacturer: p.manufacturer,
      pack: p.pack,
      group: p.group?.name ?? null,
      minPrice,
      maxPrice,
      hasMargins: p.minMargin != null || p.maxMargin != null,
    };
  });

  return NextResponse.json(priceList);
}
