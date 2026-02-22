// src/app/api/client-account-links/download/[accountId]/route.ts
// GET /api/client-account-links/download/:accountId
// Returns the latest Excel ledger for that account.
// If the file is missing (e.g. server restarted), it regenerates from DB.

import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { createClientLedger, appendOrderToLedger, LEDGER_DIR } from "../../../../../lib/excelUtils";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;

  try {
    // 1. Load account + its link token + all orders
    const account = await prisma.clientAccount.findUnique({
      where:  { id: accountId },
      select: {
        id:           true,
        name:         true,
        balance:      true,
        googleSheetId: true, // we store the excel filename here
        createdAt:    true,
        links: {
          where:  { isActive: true },
          select: { token: true },
          take:   1,
          orderBy: { createdAt: "desc" },
        },
        orders: {
          select: {
            id:           true,
            orderValue:   true,
            createdAt:    true,
            orderEntry: {
              select: {
                shipmentMode:  true,
                shippingPrice: true,
                notes:         true,
                items: {
                  select: {
                    quantity:     true,
                    sellingPrice: true,
                    product: { select: { name: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        ledger: {
          orderBy: { createdAt: "asc" },
          select:  { type: true, amount: true, orderId: true, createdAt: true },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const token    = account.links[0]?.token ?? "";
    const baseUrl  = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const orderUrl = `${baseUrl}/client-multi-form/${token}`;

    // 2. Always regenerate fresh from DB (ensures accuracy)
    //    Build order rows with running balance
    let runningBalance = 0;
    // Find opening credit from ledger
    const openingEntry = account.ledger.find(l => l.type === "CREDIT" && !l.orderId);
    const openingBalance = openingEntry ? Number(openingEntry.amount) : 0;
    runningBalance = openingBalance;

    const orderRows = account.orders
      .filter(o => o.orderEntry) // only orders that have been sales-processed
      .map(o => {
        const entry       = o.orderEntry!;
        const orderValue  = Number(o.orderValue ?? 0);
        const balBefore   = runningBalance;
        const balAfter    = balBefore - orderValue;
        runningBalance    = balAfter;

        const products = entry.items
          .map(i => `${i.product.name} x${i.quantity}`)
          .join(", ");

        const totalQty = entry.items.reduce((s, i) => s + i.quantity, 0);

        return {
          orderId:       o.id,
          placedAt:      o.createdAt,
          products,
          totalQty,
          shipmentMode:  entry.shipmentMode,
          orderValue,
          balanceBefore: balBefore,
          balanceAfter:  balAfter,
          status:        "PLACED",
          notes:         entry.notes,
        };
      });

    // 3. Generate fresh Excel file
    const filename  = await createClientLedger({
      accountId:      account.id,
      accountName:    account.name,
      openingBalance,
      token,
      orderUrl,
      createdAt:      account.createdAt,
    });

    for (const row of orderRows) {
      await appendOrderToLedger(filename, {
        orderDate:     row.placedAt.toLocaleDateString("en-IN"),
        orderId:       row.orderId,
        products:      row.products,
        totalQty:      row.totalQty,
        shipmentMode:  row.shipmentMode,
        orderValue:    row.orderValue,
        balanceBefore: row.balanceBefore,
        balanceAfter:  row.balanceAfter,
        status:        row.status,
        notes:         row.notes ?? "",
      });
    }

    // 4. Stream file as download
    const filepath = path.join(LEDGER_DIR, filename);
    const fileBuffer = fs.readFileSync(filepath);
    const safeName   = account.name.replace(/[^a-zA-Z0-9]/g, "_");

    return new NextResponse(fileBuffer, {
      status:  200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="UnnatiPharmax_${safeName}_Ledger.xlsx"`,
        "Content-Length":      String(fileBuffer.length),
      },
    });

  } catch (e: any) {
    console.error("[download ledger error]", e);
    return NextResponse.json({ error: e?.message || "Failed to generate ledger" }, { status: 500 });
  }
}