// src/app/api/client-account-links/download/[accountId]/route.ts
// ✅ Generates Excel in memory — no filesystem — works on Vercel
import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { generateLedgerBuffer } from "../../../../../lib/excelUtils";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;

  try {
    const account = await prisma.clientAccount.findUnique({
      where:  { id: accountId },
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
        ledger: {
          where:   { orderId: null },
          select:  { type: true, amount: true },
          take:    1,
          orderBy: { createdAt: "asc" },
        },
        orders: {
          orderBy: { createdAt: "asc" },
          select: {
            id:         true,
            orderValue: true,
            createdAt:  true,
            orderEntry: {
              select: {
                shipmentMode: true,
                notes:        true,
                items: {
                  select: {
                    quantity: true,
                    product:  { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!account)
      return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const token    = account.links[0]?.token ?? "";
    const baseUrl  = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const orderUrl = `${baseUrl}/client-multi-form/${token}`;
    const openingBalance = account.ledger[0] ? Number(account.ledger[0].amount) : 0;

    let running = openingBalance;
    const orders = account.orders
      .filter(o => o.orderEntry)
      .map(o => {
        const entry      = o.orderEntry!;
        const orderValue = Number(o.orderValue ?? 0);
        const before     = running;
        const after      = before - orderValue;
        running          = after;
        return {
          orderDate:     o.createdAt.toLocaleDateString("en-IN"),
          orderId:       o.id,
          products:      entry.items.map(i => `${i.product.name} x${i.quantity}`).join(", "),
          totalQty:      entry.items.reduce((s, i) => s + i.quantity, 0),
          shipmentMode:  entry.shipmentMode,
          orderValue,
          balanceBefore: before,
          balanceAfter:  after,
          status:        "PLACED",
          notes:         entry.notes,
        };
      });

    const buffer   = await generateLedgerBuffer({
      accountId,
      accountName:    account.name,
      openingBalance,
      token,
      orderUrl,
      createdAt:      account.createdAt,
      orders,
    });

    const safeName = account.name.replace(/[^a-zA-Z0-9]/g, "_");

   return new NextResponse(new Uint8Array(buffer), {
      status:  200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="UnnatiPharmax_${safeName}_Ledger.xlsx"`,
        "Content-Length":      String(buffer.length),
      },
    });

  } catch (e: any) {
    console.error("[download ledger error]", e);
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}