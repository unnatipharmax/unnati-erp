// src/app/api/products/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/auth";
import { getActiveCompanyId } from "../../../lib/company";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = await getActiveCompanyId();

  const products = await prisma.product.findMany({
    where: { isActive: true, companyId },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, manufacturer: true, hsn: true,
      pack: true, mrp: true, gstPercent: true,
      composition: true, batchNo: true, mfgDate: true, expDate: true,
      minMargin: true, maxMargin: true,
      qty: true, unitType: true, unitWeightKg: true,
      group: { select: { id: true, name: true } },
      createdAt: true,
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
      minMargin:    p.minMargin,
      maxMargin:    p.maxMargin,
      qty:          p.qty,
      unitType:     p.unitType,
      unitWeightKg: p.unitWeightKg,
      groupId:      p.group?.id   ?? null,
      groupName:    p.group?.name ?? null,
      createdAt:    p.createdAt.toISOString(),
      latestRate:   p.PurchaseItems[0]?.rate ?? null,
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
          composition, batchNo, mfgDate, expDate,
          minMargin, maxMargin, qty, unitType, unitWeightKg, groupId, force } = body;

  if (!name?.trim())
    return NextResponse.json({ error: "Product name is required" }, { status: 400 });

  const companyId = await getActiveCompanyId();

  // Duplicate guard: unless the caller confirms with force:true, look for an
  // existing product whose name matches after normalizing case/spaces/punctuation
  // (so "HORR F", "HORRF", "horr-f" all collide). If found, return the candidates
  // and let the client ask "is this the same product?".
  if (!force) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = norm(name);
    const existing = await prisma.product.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, manufacturer: true, pack: true, hsn: true },
    });
    const similar = existing.filter(p => {
      const pn = norm(p.name);
      return pn === target || pn.includes(target) || target.includes(pn);
    }).slice(0, 5);
    if (similar.length > 0) {
      return NextResponse.json({ similar }, { status: 409 });
    }
  }

  try {
    const product = await prisma.product.create({
      data: {
        companyId,
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
        minMargin:    minMargin    ? Number(minMargin)    : null,
        maxMargin:    maxMargin    ? Number(maxMargin)    : null,
        qty:          qty          ? Number(qty)          : null,
        unitType:     unitType?.trim()     || null,
        unitWeightKg: unitWeightKg ? Number(unitWeightKg) : null,
        groupId:      groupId || null,
      },
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
