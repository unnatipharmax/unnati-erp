// GET /api/companies/[id] — full details for a company (edit form)
// PUT /api/companies/[id] — update a company (ADMIN only)
// DELETE /api/companies/[id] — deactivate a company (ADMIN only, soft delete)
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const company = await prisma.companySetting.findUnique({ where: { id } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ company });
}

const STR_FIELDS = [
  "name", "address", "email", "phone", "website", "indiamart", "marketing",
  "gstin", "iec", "drugLic", "chaName", "chaNo",
  "bankName", "bankAccount", "bankIfsc", "bankBranch", "bankSwift",
] as const;

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: Record<string, unknown> = {};
  for (const f of STR_FIELDS) {
    if (body[f] !== undefined) data[f] = String(body[f]).trim();
  }
  // Base64 blobs — kept as-is when provided (may be large)
  if (body.stampB64 !== undefined) data.stampB64 = String(body.stampB64);
  if (body.sigB64   !== undefined) data.sigB64   = String(body.sigB64);
  if (body.logoB64  !== undefined) data.logoB64  = String(body.logoB64);
  if (body.invoicePrefix !== undefined) data.invoicePrefix = String(body.invoicePrefix).trim() || "E";
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  if (data.name !== undefined && !data.name)
    return NextResponse.json({ error: "Company name cannot be empty" }, { status: 400 });

  try {
    const company = await prisma.companySetting.update({
      where: { id },
      data,
      select: { id: true, name: true },
    });
    return NextResponse.json({ company });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  // Never allow deleting the last active company.
  const activeCount = await prisma.companySetting.count({ where: { isActive: true } });
  if (activeCount <= 1)
    return NextResponse.json({ error: "Cannot deactivate the only company" }, { status: 400 });

  try {
    await prisma.companySetting.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
