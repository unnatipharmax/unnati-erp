// src/app/api/products/route.ts
// POST /api/products — creates a new product in Product Master
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const products = await prisma.product.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select:  { id: true, name: true, manufacturer: true, mrp: true },
  });
  return NextResponse.json({ products });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, manufacturer, hsn, pack, mrp, gstPercent } = body;

    if (!name?.trim())
      return NextResponse.json({ error: "Product name is required" }, { status: 400 });

    // Check for duplicate name
    const existing = await prisma.product.findFirst({
      where: { name: { equals: name.trim(), mode: "insensitive" } },
    });
    if (existing)
      return NextResponse.json({ error: "Product with this name already exists" }, { status: 409 });

    const product = await prisma.product.create({
      data: {
        name:         name.trim(),
        manufacturer: manufacturer ?? null,
        hsn:          hsn          ?? null,
        pack:         pack         ?? null,
        mrp:          mrp          ? Number(mrp)          : null,
        gstPercent:   gstPercent   ? Number(gstPercent)   : null,
        isActive:     true,
      },
      select: { id: true, name: true, manufacturer: true, mrp: true },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (e: any) {
    console.error("[create product error]", e);
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}