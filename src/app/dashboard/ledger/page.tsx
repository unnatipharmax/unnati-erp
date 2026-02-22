// src/app/dashboard/ledger/page.tsx
import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import LedgerClient from "./LedgerClient";

export default async function LedgerPage() {
  const session = await getSession();
  if (!session || !["ADMIN","MANAGER","ACCOUNTS"].includes(session.role))
    redirect("/dashboard");

  const accounts = await prisma.clientAccount.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, balance: true, createdAt: true,
      _count: { select: { orders: true } },
      links: { where: { isActive: true }, select: { token: true }, take: 1, orderBy: { createdAt: "desc" } },
    },
  });

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1>Accounts Ledger</h1>
        <p>Select a client account to enter payment details for each order.</p>
      </div>
      <LedgerClient
        accounts={accounts.map(a => ({
          id:         a.id,
          name:       a.name,
          balance:    Number(a.balance),
          createdAt:  a.createdAt.toISOString(),
          orderCount: a._count.orders,
          token:      a.links[0]?.token ?? null,
        }))}
      />
    </div>
  );
}