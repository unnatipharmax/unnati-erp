import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "unnati-pharmax-dev-secret-key-change-me");
const COOKIE  = "unnati_session";

const PUBLIC_PATHS = ["/login", "/client-form", "/client-multi-form", "/api/client-form-submit", "/api/client-multi-form-submit"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();
  // Allow API routes (protected individually) and static assets
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/_next") || pathname === "/favicon.ico") return NextResponse.next();

  // Only protect /dashboard routes
  if (!pathname.startsWith("/dashboard")) return NextResponse.next();

  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const role = payload.role as string;

    // Role-based path guards
    const ROLE_ACCESS: Record<string, string[]> = {
      ADMIN:     ["*"],
      MANAGER:   ["/dashboard", "/dashboard/client-forms", "/dashboard/order-entry", "/dashboard/party", "/dashboard/product-master", "/dashboard/purchase", "/dashboard/ocr"],
      SALES:     ["/dashboard", "/dashboard/client-forms", "/dashboard/order-entry", "/dashboard/product-master"],
      ACCOUNTS:  ["/dashboard", "/dashboard/client-forms", "/dashboard/purchase"],
      PACKAGING: ["/dashboard", "/dashboard/order-initiation"],
    };

    const perms = ROLE_ACCESS[role] ?? [];
    const allowed = perms.includes("*") || perms.some(p => pathname === p || pathname.startsWith(p + "/"));

    if (!allowed) return NextResponse.redirect(new URL("/dashboard", req.url));

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};