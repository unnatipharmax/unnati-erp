import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId");
  if (!orderId) return NextResponse.redirect(new URL("/dashboard/order-entry", req.url));
  return NextResponse.redirect(new URL(`/dashboard/order-entry/${orderId}`, req.url));
}

export async function POST(req: Request) {
  const form = await req.formData();
  const orderId = String(form.get("orderId") || "");
  if (!orderId) return NextResponse.redirect(new URL("/dashboard/order-entry", req.url));
  return NextResponse.redirect(new URL(`/dashboard/order-entry/${orderId}`, req.url));
}
