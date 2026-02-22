// src/app/api/products/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Soft delete — keeps history intact
    await prisma.product.update({
      where: { id },
      data:  { isActive: false },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }  = await params;
    const body    = await req.json();

    const product = await prisma.product.update({
      where: { id },
      data: {
        name:         body.name         ?? undefined,
        manufacturer: body.manufacturer ?? undefined,
        hsn:          body.hsn          ?? undefined,
        pack:         body.pack         ?? undefined,
        mrp:          body.mrp          != null ? Number(body.mrp)          : undefined,
        gstPercent:   body.gstPercent   != null ? Number(body.gstPercent)   : undefined,
      },
      select: { id: true, name: true, manufacturer: true, hsn: true, pack: true, mrp: true, gstPercent: true },
    });

    return NextResponse.json(product);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}