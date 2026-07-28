import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body   = await req.json();
  const data: any = {};

  if (body.role)     data.role  = body.role;
  if (body.name)     data.name  = body.name;
  if (body.email)    data.email = body.email.trim().toLowerCase();
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.password) data.password = await bcrypt.hash(body.password, 12);

  const user = await prisma.user.update({
    where: { id }, data,
    select: { id: true, username: true, email: true, name: true, role: true, isActive: true },
  });
  return NextResponse.json(user);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === session.id)
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });

  // Don't let the last active admin be removed.
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.role === "ADMIN") {
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    if (activeAdmins <= 1)
      return NextResponse.json({ error: "Cannot delete the only admin" }, { status: 400 });
  }

  // Hard delete. Orders keep filledByUserId as a plain string (no FK), so nothing
  // breaks — the deleted user's name simply won't resolve on those old orders.
  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}