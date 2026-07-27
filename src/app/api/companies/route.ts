// GET  /api/companies — list companies (for switcher + management)
// POST /api/companies — create a new company (ADMIN only)
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/auth";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

// Lightweight shape for the switcher (no heavy base64 blobs).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companies = await prisma.companySetting.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, gstin: true, invoicePrefix: true, logoB64: true },
  });
  return NextResponse.json({ companies });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Company name is required" }, { status: 400 });

  const invoicePrefix = String(body.invoicePrefix ?? "E").trim() || "E";

  try {
    const company = await prisma.companySetting.create({
      data: {
        id: randomUUID(),
        name,
        address:     String(body.address     ?? "").trim(),
        email:       String(body.email       ?? "").trim(),
        phone:       String(body.phone       ?? "").trim(),
        website:     String(body.website     ?? "").trim(),
        indiamart:   String(body.indiamart   ?? "").trim(),
        marketing:   String(body.marketing   ?? "").trim(),
        gstin:       String(body.gstin       ?? "").trim(),
        iec:         String(body.iec         ?? "").trim(),
        drugLic:     String(body.drugLic     ?? "").trim(),
        chaName:     String(body.chaName     ?? "").trim(),
        chaNo:       String(body.chaNo       ?? "").trim(),
        stampB64:    String(body.stampB64    ?? ""),
        sigB64:      String(body.sigB64      ?? ""),
        logoB64:     String(body.logoB64     ?? ""),
        invoicePrefix,
        bankName:    String(body.bankName    ?? "").trim(),
        bankAccount: String(body.bankAccount ?? "").trim(),
        bankIfsc:    String(body.bankIfsc    ?? "").trim(),
        bankBranch:  String(body.bankBranch  ?? "").trim(),
        bankSwift:   String(body.bankSwift   ?? "").trim(),
        isActive:    true,
      },
      select: { id: true, name: true },
    });
    return NextResponse.json({ company }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
