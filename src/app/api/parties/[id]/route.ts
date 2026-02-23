import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["ADMIN","MANAGER"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { name, address, gstNumber, drugLicenseNumber, notes, phone, email } = await req.json();

  const party = await prisma.party.update({
    where: { id },
    data: {
      name:              name?.trim()        || undefined,
      address:           address             || null,
      gstNumber:         gstNumber           || null,
      drugLicenseNumber: drugLicenseNumber   || null,
      notes:             notes               || null,
    },
  });

  // Update phone: delete old, create new
  if (phone !== undefined) {
    await prisma.phone.deleteMany({ where: { partyId: id } });
    if (phone) await prisma.phone.create({ data: { phone, partyId: id } });
  }
  // Update email: delete old, create new
  if (email !== undefined) {
    await prisma.email.deleteMany({ where: { partyId: id } });
    if (email) await prisma.email.create({ data: { email, partyId: id } });
  }

  return NextResponse.json({ party });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["ADMIN","MANAGER"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.party.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}