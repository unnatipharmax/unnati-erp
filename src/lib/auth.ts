import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type Role = "ADMIN" | "MANAGER" | "SALES" | "ACCOUNTS" | "PACKAGING";

export type SessionUser = {
  id:       string;
  username: string;
  name:     string;
  role:     Role;
};

const SECRET      = new TextEncoder().encode(process.env.JWT_SECRET ?? "unnati-pharmax-dev-secret-key-change-me");
export const COOKIE_NAME = "unnati_session";

export async function createToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionUser;
  } catch { return null; }
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch { return null; }
}

// ── Role-based access ─────────────────────────────────────────────────────────
export const MENU_ITEMS = [
  { name: "HOME",             path: "/dashboard",                roles: ["ADMIN","MANAGER","SALES","ACCOUNTS","PACKAGING"] as Role[] },
  { name: "ORDER INITIATION", path: "/dashboard/client-forms",   roles: ["ADMIN","MANAGER","SALES","ACCOUNTS"] as Role[] },
  { name: "ORDER ENTRY",      path: "/dashboard/order-entry",    roles: ["ADMIN","MANAGER","SALES"] as Role[] },
  { name: "PARTY MASTER",     path: "/dashboard/party",          roles: ["ADMIN","MANAGER"] as Role[] },
  { name: "PRODUCT MASTER",   path: "/dashboard/product-master", roles: ["ADMIN","MANAGER","SALES"] as Role[] },
  { name: "PURCHASE BILL",    path: "/dashboard/purchase",       roles: ["ADMIN","MANAGER","ACCOUNTS"] as Role[] },
  { name: "OCR (GEMINI)",     path: "/dashboard/ocr",            roles: ["ADMIN","MANAGER"] as Role[] },
  { name: "SETUP",            path: "/dashboard/setup",          roles: ["ADMIN"] as Role[] },
];

export const ROLE_ACCESS: Record<Role, string[]> = {
  ADMIN:     ["*"],
  MANAGER:   ["/dashboard", "/dashboard/client-forms", "/dashboard/order-entry", "/dashboard/party", "/dashboard/product-master", "/dashboard/purchase", "/dashboard/ocr"],
  SALES:     ["/dashboard", "/dashboard/client-forms", "/dashboard/order-entry", "/dashboard/product-master"],
  ACCOUNTS:  ["/dashboard", "/dashboard/client-forms", "/dashboard/purchase"],
  PACKAGING: ["/dashboard", "/dashboard/order-initiation"],
};

export function canAccess(role: Role, path: string): boolean {
  const perms = ROLE_ACCESS[role];
  if (perms.includes("*")) return true;
  return perms.some(p => path === p || path.startsWith(p + "/"));
}

export const ROLE_COLORS: Record<Role, string> = {
  ADMIN:     "badge-blue",
  MANAGER:   "badge-amber",
  SALES:     "badge-green",
  ACCOUNTS:  "badge-gray",
  PACKAGING: "badge-gray",
};