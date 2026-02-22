// GET /api/ledger — all client accounts with order counts for ledger page
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const accounts = await prisma.clientAccount.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, balance: true, createdAt: true,
      _count: { select: { orders: true } },
      links: {
        where: { isActive: true }, select: { token: true },
        take: 1, orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json({
    accounts: accounts.map(a => ({
      id:          a.id,
      name:        a.name,
      balance:     Number(a.balance),
      createdAt:   a.createdAt.toISOString(),
      orderCount:  a._count.orders,
      token:       a.links[0]?.token ?? null,
    })),
  });
}