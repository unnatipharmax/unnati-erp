import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { createToken, COOKIE_NAME } from "../../../../lib/auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (!username || !password)
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } });
    if (!user || !user.isActive)
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });

    const token = await createToken({ id: user.id, username: user.username, name: user.name, role: user.role as any });

    const res = NextResponse.json({ ok: true, name: user.name, role: user.role });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   8 * 60 * 60,
      path:     "/",
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Login failed" }, { status: 500 });
  }
}