import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "../../../lib/prisma";

export const runtime = "nodejs"; // IMPORTANT (Prisma + crypto)

export async function POST() {
  const token = crypto.randomBytes(24).toString("hex"); // 48 chars
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  const link = await prisma.clientFormLink.create({
    data: {
      token,
      expiresAt,
      isUsed: false,
    },
    select: { token: true, expiresAt: true },
  });

  // You can return a full URL if you want:
  // const url = `${process.env.NEXT_PUBLIC_APP_URL}/client-form/${link.token}`;

  return NextResponse.json(link, { status: 201 });
}
