// GET /api/client-master  — list all active client accounts with phones/emails
// POST /api/client-master — create a new client account

import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clients = await prisma.clientAccount.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      phones: true,
      emails: true,
      _count: { select: { orders: true } },
    },
  });

  return NextResponse.json({
    clients: clients.map(c => ({
      ...c,
      balance: c.balance.toString(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, address, gstNumber, drugLicenseNumber, notes, phone, email } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const client = await prisma.clientAccount.create({
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

  return NextResponse.json({ client: { ...client, balance: client.balance.toString() } }, { status: 201 });
}
