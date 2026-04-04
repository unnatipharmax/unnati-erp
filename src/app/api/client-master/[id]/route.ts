// PATCH /api/client-master/[id] — update a client account
// DELETE /api/client-master/[id] — soft-delete a client account

import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { name, address, gstNumber, drugLicenseNumber, notes, phone, email } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // Update phone: delete existing then create new if provided
  await prisma.clientPhone.deleteMany({ where: { accountId: id } });
  await prisma.clientEmail.deleteMany({ where: { accountId: id } });

  const client = await prisma.clientAccount.update({
    where: { id },
    data: {
      name:              name.trim(),
      address:           address           || null,
      gstNumber:         gstNumber         || null,
      drugLicenseNumber: drugLicenseNumber || null,
      notes:             notes             || null,
      phones: phone ? { create: { phone } } : undefined,
      emails: email ? { create: { email } } : undefined,
    },
    include: { phones: true, emails: true },
  });

  return NextResponse.json({ client: { ...client, balance: client.balance.toString() } });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.clientAccount.update({
    where: { id },
    data:  { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
