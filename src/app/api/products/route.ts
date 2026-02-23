// src/app/api/products/route.ts
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
      id: true, name: true, manufacturer: true, hsn: true,
      pack: true, mrp: true, gstPercent: true,
      composition: true, batchNo: true, mfgDate: true, expDate: true,
      createdAt: true,
      // Latest purchase rate for INR Unit calculation
      PurchaseItems: {
        select: { rate: true },
        orderBy: { id: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json({
    products: products.map(p => ({
      id:           p.id,
      name:         p.name,
      manufacturer: p.manufacturer,
      hsn:          p.hsn,
      pack:         p.pack,
      mrp:          p.mrp,
      gstPercent:   p.gstPercent,
      composition:  p.composition,
      batchNo:      p.batchNo,
      mfgDate:      p.mfgDate,
      expDate:      p.expDate,
      createdAt:    p.createdAt.toISOString(),
      // Latest purchase rate
      latestRate:   p.PurchaseItems[0]?.rate ?? null,
      // INR Unit = purchase rate + 15%
      inrUnit:      p.PurchaseItems[0]?.rate
                      ? Math.round(p.PurchaseItems[0].rate * 1.15 * 100) / 100
                      : null,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "SALES"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, manufacturer, hsn, pack, mrp, gstPercent,
          composition, batchNo, mfgDate, expDate } = body;

  if (!name?.trim())
    return NextResponse.json({ error: "Product name is required" }, { status: 400 });

  try {
    const product = await prisma.product.create({
      data: {
        name:         name.trim(),
        manufacturer: manufacturer?.trim() || null,
        hsn:          hsn?.trim()          || null,
        pack:         pack?.trim()         || null,
        mrp:          mrp          ? Number(mrp)          : null,
        gstPercent:   gstPercent   ? Number(gstPercent)   : null,
        composition:  composition?.trim()  || null,
        batchNo:      batchNo?.trim()      || null,
        mfgDate:      mfgDate?.trim()      || null,
        expDate:      expDate?.trim()      || null,
      },
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}