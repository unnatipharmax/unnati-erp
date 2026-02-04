import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { Prisma, LedgerType } from "@prisma/client";
import crypto from "crypto";

export const runtime = "nodejs";

function makeToken() {
  return crypto.randomBytes(24).toString("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const name = String(body?.name ?? "").trim();
    const openingBalanceRaw = body?.openingBalance ?? "0";

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Client name required" }, { status: 400 });
    }

    const opening = new Prisma.Decimal(String(openingBalanceRaw || "0"));
    if (opening.lessThan(0)) {
      return NextResponse.json(
        { error: "Opening balance cannot be negative" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const result = await prisma.$transaction(async (tx) => {
      // 1) Create account
      const account = await tx.clientAccount.create({
        data: {
          name,
          balance: opening,
          isActive: true,
        },
        select: { id: true, name: true, balance: true },
      });

      // 2) Ledger credit (audit)
      if (opening.greaterThan(0)) {
        await tx.accountLedger.create({
          data: {
            accountId: account.id,
            type: LedgerType.CREDIT,
            amount: opening,
            note: "Opening balance",
          },
        });
      }

      // 3) Link token
      const token = makeToken();
      await tx.clientAccountLink.create({
        data: {
          token,
          accountId: account.id,
          isActive: true,
        },
        select: { id: true },
      });

      return {
        accountId: account.id,
        token,
        balance: account.balance.toString(),
        url: `${baseUrl}/client-multi-form/${token}`,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("client-account-links error:", e);
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
    