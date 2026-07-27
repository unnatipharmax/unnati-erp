// src/app/api/products/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";
import { getActiveCompanyId } from "../../../../lib/company";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "SALES"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const data: any = {};
  const strFields = ["name","manufacturer","hsn","pack","composition","batchNo","mfgDate","expDate","unitType"];
  const numFields = ["mrp","gstPercent","minMargin","maxMargin","unitWeightKg"];
  const intFields = ["qty"];

  for (const f of strFields) {
    if (body[f] !== undefined) data[f] = body[f]?.toString().trim() || null;
  }
  for (const f of numFields) {
    if (body[f] !== undefined) data[f] = body[f] ? Number(body[f]) : null;
  }
  for (const f of intFields) {
    if (body[f] !== undefined) data[f] = body[f] ? parseInt(body[f], 10) : null;
  }
  if (body.groupId !== undefined) {
    // scalar FK (updateMany can't use relation connect/disconnect)
    data.groupId = body.groupId || null;
  }

  const companyId = await getActiveCompanyId();

  try {
    // Scoped update: only touches the product if it belongs to the active company.
    const res = await prisma.product.updateMany({ where: { id, companyId }, data });
    if (res.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const product = await prisma.product.findUnique({ where: { id } });
    return NextResponse.json({ product });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const companyId = await getActiveCompanyId();
  const res = await prisma.product.updateMany({ where: { id, companyId }, data: { isActive: false } });
  if (res.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}