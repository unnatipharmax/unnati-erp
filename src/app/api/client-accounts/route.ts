// src/app/api/client-accounts/route.ts
// GET /api/client-accounts — returns all ClientAccounts with their active link token
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const accounts = await prisma.clientAccount.findMany({
      where:   { isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id:        true,
        name:      true,
        balance:   true,
        createdAt: true,
        links: {
          where:   { isActive: true },
          select:  { token: true },
          take:    1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({
      accounts: accounts.map(a => ({
        id:        a.id,
        name:      a.name,
        balance:   a.balance.toString(),
        createdAt: a.createdAt.toISOString(),
        token:     a.links[0]?.token ?? null,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}