import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groups = await prisma.productGroup.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json({ groups });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name } = await req.json();
  if (!name?.trim())
    return NextResponse.json({ error: "Group name is required" }, { status: 400 });

  try {
    const group = await prisma.productGroup.create({
      data: { name: name.trim() },
    });
    return NextResponse.json({ group }, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002")
      return NextResponse.json({ error: "Group already exists" }, { status: 409 });
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
