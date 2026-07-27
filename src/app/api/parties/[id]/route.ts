import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";
import { getActiveCompanyId } from "../../../../lib/company";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["ADMIN","MANAGER"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { name, address, gstNumber, drugLicenseNumber, notes, phone, email } = await req.json();

  const companyId = await getActiveCompanyId();

  const updated = await prisma.party.updateMany({
    where: { id, companyId },
    data: {
      name:              name?.trim()        || undefined,
      address:           address             || null,
      gstNumber:         gstNumber           || null,
      drugLicenseNumber: drugLicenseNumber   || null,
      notes:             notes               || null,
    },
  });
  if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const party = await prisma.party.findFirst({ where: { id, companyId } });
  return NextResponse.json({ party });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["ADMIN","MANAGER"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const companyId = await getActiveCompanyId();
  const res = await prisma.party.updateMany({ where: { id, companyId }, data: { isActive: false } });
  if (res.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}