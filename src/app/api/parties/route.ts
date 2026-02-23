import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parties = await prisma.party.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      phones: true,
      emails: true,
      _count: { select: { PurchaseBills: true } },
    },
  });
  return NextResponse.json({ parties });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN","MANAGER"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, address, gstNumber, drugLicenseNumber, notes, phone, email } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const party = await prisma.party.create({
    data: {
      name: name.trim(),
      address:           address           || null,
      gstNumber:         gstNumber         || null,
      drugLicenseNumber: drugLicenseNumber || null,
      notes:             notes             || null,
      phones: phone ? { create: { phone } } : undefined,
      emails: email ? { create: { email } } : undefined,
    },
    include: { phones: true, emails: true },
  });
  return NextResponse.json({ party }, { status: 201 });
}