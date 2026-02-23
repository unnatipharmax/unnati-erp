// src/app/api/products/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";

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
  const fields = ["name","manufacturer","hsn","pack","mrp","gstPercent",
                  "composition","batchNo","mfgDate","expDate"];

  for (const f of fields) {
    if (body[f] !== undefined) {
      if (f === "mrp" || f === "gstPercent") {
        data[f] = body[f] ? Number(body[f]) : null;
      } else {
        data[f] = body[f]?.toString().trim() || null;
      }
    }
  }

  try {
    const product = await prisma.product.update({ where: { id }, data });
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
  await prisma.product.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}