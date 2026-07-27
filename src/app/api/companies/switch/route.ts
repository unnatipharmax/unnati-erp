// POST /api/companies/switch — set the active company cookie.
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";
import { COMPANY_COOKIE } from "../../../../lib/company";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const companyId = String(body.companyId ?? "").trim();
  if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });

  const company = await prisma.companySetting.findFirst({
    where: { id: companyId, isActive: true },
    select: { id: true, name: true },
  });
  if (!company) return NextResponse.json({ error: "Invalid company" }, { status: 400 });

  const res = NextResponse.json({ success: true, company });
  res.cookies.set(COMPANY_COOKIE, company.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return res;
}
