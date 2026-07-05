import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getActiveCompanyId } from "../../../../lib/company";

export const runtime = "nodejs";

async function resolve(raw: string, baseUrl: string): Promise<NextResponse> {
  const q = raw.trim();
  if (!q) return NextResponse.redirect(new URL("/dashboard/order-entry", baseUrl));
  const companyId = await getActiveCompanyId();

  // 1. Exact ID match (scoped to active company)
  const exact = await prisma.orderInitiation.findFirst({
    where: { id: q, companyId },
    select: { id: true },
  });
  if (exact) return NextResponse.redirect(new URL(`/dashboard/order-entry/${exact.id}`, baseUrl));

  // 2. ID prefix match (user pasted short ID e.g. first 8 chars)
  const prefix = await prisma.orderInitiation.findFirst({
    where: { id: { startsWith: q }, companyId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (prefix) return NextResponse.redirect(new URL(`/dashboard/order-entry/${prefix.id}`, baseUrl));

  // 3. Invoice number match (e.g. E-2526-001)
  const byInvoice = await prisma.orderInitiation.findFirst({
    where: { invoiceNo: { equals: q, mode: "insensitive" }, companyId },
    select: { id: true },
  });
  if (byInvoice) return NextResponse.redirect(new URL(`/dashboard/order-entry/${byInvoice.id}`, baseUrl));

  // 4. Full name contains (case-insensitive)
  const byName = await prisma.orderInitiation.findFirst({
    where: { fullName: { contains: q, mode: "insensitive" }, companyId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (byName) return NextResponse.redirect(new URL(`/dashboard/order-entry/${byName.id}`, baseUrl));

  // 5. Email or phone match
  const byContact = await prisma.orderInitiation.findFirst({
    where: {
      companyId,
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (byContact) return NextResponse.redirect(new URL(`/dashboard/order-entry/${byContact.id}`, baseUrl));

  // Not found
  return NextResponse.redirect(new URL(`/dashboard/order-entry?error=not-found&q=${encodeURIComponent(q)}`, baseUrl));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("orderId") ?? "";
  return resolve(raw, req.url);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const raw  = String(form.get("orderId") ?? "");
  return resolve(raw, req.url);
}
