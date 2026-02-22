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
      where: { id: accountId },
      select: {
        id: true, name: true, balance: true, createdAt: true,
        links:  { where: { isActive: true }, select: { token: true }, take: 1, orderBy: { createdAt: "desc" } },
        ledger: { where: { orderId: null }, select: { amount: true }, take: 1, orderBy: { createdAt: "asc" } },
        orders: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true, orderValue: true, status: true,
            fullName: true, address: true, city: true,
            state: true, postalCode: true, country: true, createdAt: true,
            inrAmount: true, dollarAmount: true,
            exchangeRate: true, grsNumber: true, paymentDepositDate: true,
            orderEntry: {
              select: {
                shipmentMode: true, shippingPrice: true, notes: true,
                items: {
                  select: {
                    quantity: true, sellingPrice: true,
                    product: { select: { name: true } },
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

    const token          = account.links[0]?.token ?? "";
    const baseUrl        = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const orderUrl       = `${baseUrl}/client-multi-form/${token}`;
    const openingBalance = account.ledger[0] ? Number(account.ledger[0].amount) : 0;
    let running          = openingBalance;

    const orders = account.orders.map(o => {
      const hasEntry      = !!o.orderEntry;
      const items         = o.orderEntry?.items ?? [];
      const brandName     = items.map(i => i.product.name).join(", ") || "—";
      const quantity      = items.reduce((s, i) => s + i.quantity, 0);
      const totalValue    = items.reduce((s, i) => s + Number(i.sellingPrice) * i.quantity, 0);
      const unitPrice     = quantity > 0 ? totalValue / quantity : 0;
      const shippingPrice = hasEntry ? Number(o.orderEntry!.shippingPrice) : 0;
      const orderValue    = hasEntry ? totalValue + shippingPrice : Number(o.orderValue ?? 0);
      const before        = running;
      const after         = hasEntry ? before - orderValue : before;
      if (hasEntry) running = after;

      return {
        orderId: o.id, orderDate: o.createdAt.toLocaleDateString("en-IN"),
        fullName: o.fullName, address: o.address, city: o.city,
        state: o.state, postalCode: o.postalCode, country: o.country,
        trackingNo: null, brandName, quantity, unitPrice,
        shipmentMode:  hasEntry ? o.orderEntry!.shipmentMode : "—",
        shippingPrice,
        notes:         hasEntry ? (o.orderEntry!.notes ?? "") : "Pending entry",
        exchangeRate:  o.exchangeRate ? Number(o.exchangeRate) : 84,
        orderValue, balanceBefore: before, balanceAfter: after,
        status:      o.status,
        inrAmount:   o.inrAmount        ? Number(o.inrAmount)        : undefined,
        dollarAmount: o.dollarAmount    ? Number(o.dollarAmount)     : undefined,
        paymentDate:  o.paymentDepositDate ? o.paymentDepositDate.toISOString().split("T")[0] : undefined,
        grsNumber:    o.grsNumber ?? undefined,
      };
    });

    const buffer   = await generateLedgerBuffer({ accountId, accountName: account.name, openingBalance, token, orderUrl, createdAt: account.createdAt, orders });
    const safeName = account.name.replace(/[^a-zA-Z0-9]/g, "_");

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="UnnatiPharmax_${safeName}_Ledger.xlsx"`,
        "Content-Length":      String(buffer.length),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}