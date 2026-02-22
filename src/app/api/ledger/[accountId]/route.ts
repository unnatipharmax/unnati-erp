// GET /api/ledger/[accountId] — orders for one account with payment fields
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { accountId } = await params;

  const [account, orders] = await Promise.all([
    prisma.clientAccount.findUnique({
      where:  { id: accountId },
      select: { id: true, name: true, balance: true },
    }),
    prisma.orderInitiation.findMany({
      where:   { accountId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, fullName: true, status: true, createdAt: true,
        orderValue: true,
        inrAmount: true, dollarAmount: true,
        exchangeRate: true, grsNumber: true, paymentDepositDate: true,
        orderEntry: {
          select: {
            shippingPrice: true, shipmentMode: true,
            items: {
              select: {
                quantity: true, sellingPrice: true,
                product: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  if (!account)
    return NextResponse.json({ error: "Account not found" }, { status: 404 });

  return NextResponse.json({
    account: { ...account, balance: Number(account.balance) },
    orders: orders.map(o => ({
      id:          o.id,
      fullName:    o.fullName,
      status:      o.status,
      createdAt:   o.createdAt.toISOString(),
      orderValue:  o.orderValue ? Number(o.orderValue) : null,
      brandName:   o.orderEntry?.items.map(i => i.product.name).join(", ") || null,
      quantity:    o.orderEntry?.items.reduce((s, i) => s + i.quantity, 0) ?? 0,
      shipmentMode: o.orderEntry?.shipmentMode ?? null,
      shippingPrice: o.orderEntry ? Number(o.orderEntry.shippingPrice) : 0,
      // Payment fields
      inrAmount:          o.inrAmount          ? Number(o.inrAmount)          : null,
      dollarAmount:       o.dollarAmount       ? Number(o.dollarAmount)       : null,
      exchangeRate:       o.exchangeRate       ? Number(o.exchangeRate)       : null,
      grsNumber:          o.grsNumber          ?? null,
      paymentDepositDate: o.paymentDepositDate ? o.paymentDepositDate.toISOString().split("T")[0] : null,
    })),
  });
}   