import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, username: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { username, email, password, name, role } = await req.json();
    if (!username || !email || !password || !name || !role)
      return NextResponse.json({ error: "All fields required" }, { status: 400 });

    const hashed = await bcrypt.hash(password, 12);
    const user   = await prisma.user.create({
      data: {
        username: username.trim().toLowerCase(),
        email:    email.trim().toLowerCase(),
        password: hashed,
        name:     name.trim(),
        role,
      },
      select: { id: true, username: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "Username or email already exists" }, { status: 409 });
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}