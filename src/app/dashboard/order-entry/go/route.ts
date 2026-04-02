import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

async function resolve(raw: string, baseUrl: string): Promise<NextResponse> {
  const q = raw.trim();
  if (!q) return NextResponse.redirect(new URL("/dashboard/order-entry", baseUrl));

  // 1. Exact ID match
  const exact = await prisma.orderInitiation.findUnique({
    where: { id: q },
    select: { id: true },
  });
  if (exact) return NextResponse.redirect(new URL(`/dashboard/order-entry/${exact.id}`, baseUrl));

  // 2. ID prefix match (user pasted short ID e.g. first 8 chars)
  const prefix = await prisma.orderInitiation.findFirst({
    where: { id: { startsWith: q } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (prefix) return NextResponse.redirect(new URL(`/dashboard/order-entry/${prefix.id}`, baseUrl));

  // 3. Invoice number match (e.g. E-2526-001)
  const byInvoice = await prisma.orderInitiation.findFirst({
    where: { invoiceNo: { equals: q, mode: "insensitive" } },
    select: { id: true },
  });
  if (byInvoice) return NextResponse.redirect(new URL(`/dashboard/order-entry/${byInvoice.id}`, baseUrl));

  // 4. Full name contains (case-insensitive)
  const byName = await prisma.orderInitiation.findFirst({
    where: { fullName: { contains: q, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (byName) return NextResponse.redirect(new URL(`/dashboard/order-entry/${byName.id}`, baseUrl));

  // 5. Email or phone match
  const byContact = await prisma.orderInitiation.findFirst({
    where: {
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
