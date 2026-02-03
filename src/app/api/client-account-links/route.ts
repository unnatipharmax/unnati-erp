import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";

export async function POST() {
  try {
    // you can later change this to accept account name in body
    const account = await prisma.clientAccount.create({
      data: {
        name: "Advance Client",
        balance: 0,
      },
      select: { id: true },
    });

    const token = crypto.randomBytes(24).toString("hex");

    await prisma.clientAccountLink.create({
      data: {
        token,
        accountId: account.id,
        isActive: true,
      },
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    return NextResponse.json({
      token,
      url: `${baseUrl}/client-multi-form/${token}`,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}
