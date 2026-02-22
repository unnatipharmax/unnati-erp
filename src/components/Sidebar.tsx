"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Home, Link, FileText, Users, Package, Image as ImageIcon, Settings } from "lucide-react";

type Role = "ADMIN" | "MANAGER" | "SALES" | "ACCOUNTS" | "PACKAGING";

const ALL_MENU = [
  { name: "HOME",             path: "/dashboard",                icon: Home,      roles: ["ADMIN","MANAGER","SALES","ACCOUNTS","PACKAGING"] },
  { name: "ORDER INITIATION", path: "/dashboard/client-forms",   icon: Link,      roles: ["ADMIN","MANAGER","SALES","ACCOUNTS"] },
  { name: "ORDER ENTRY",      path: "/dashboard/order-entry",    icon: FileText,  roles: ["ADMIN","MANAGER","SALES"] },
  { name: "PARTY MASTER",     path: "/dashboard/party",          icon: Users,     roles: ["ADMIN","MANAGER"] },
  { name: "PRODUCT MASTER",   path: "/dashboard/product-master", icon: Package,   roles: ["ADMIN","MANAGER","SALES"] },
  { name: "PURCHASE BILL",    path: "/dashboard/purchase",       icon: FileText,  roles: ["ADMIN","MANAGER","ACCOUNTS"] },
  { name: "OCR (GEMINI)",     path: "/dashboard/ocr",            icon: ImageIcon, roles: ["ADMIN","MANAGER"] },
  { name: "SETUP",            path: "/dashboard/setup",          icon: Settings,  roles: ["ADMIN"] },
];

const ROLE_BADGE: Record<Role, { bg: string; color: string }> = {
  ADMIN:     { bg: "rgba(59,130,246,0.15)",  color: "#93c5fd" },
  MANAGER:   { bg: "rgba(245,158,11,0.15)",  color: "#fcd34d" },
  SALES:     { bg: "rgba(16,185,129,0.15)",  color: "#6ee7b7" },
  ACCOUNTS:  { bg: "rgba(156,163,175,0.15)", color: "#9ca3af" },
  PACKAGING: { bg: "rgba(156,163,175,0.15)", color: "#9ca3af" },
};

export default function Sidebar({ userName, userRole }: { userName: string; userRole: Role }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const menu  = ALL_MENU.filter(item => item.roles.includes(userRole));
  const badge = ROLE_BADGE[userRole];

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside style={{
      width: 240, minHeight: "100vh", flexShrink: 0,
      background: "var(--surface-1)", borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Logo */}
      <div style={{ padding: "1.25rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          UNNATI PHARMAX
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>ERP System</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0.75rem", display: "flex", flexDirection: "column", gap: 2 }}>
        {menu.map(item => {
          const Icon   = item.icon;
          const active = pathname === item.path || pathname.startsWith(item.path + "/");
          return (
            <a key={item.path} href={item.path} className={`nav-link${active ? " active" : ""}`}>
              <Icon size={15} strokeWidth={2} />
              {item.name}
            </a>
          );
        })}
      </nav>

      {/* User + logout */}
      <div style={{ padding: "0.75rem", borderTop: "1px solid var(--border)" }}>
        <div style={{ padding: "0.75rem", borderRadius: 12, background: "var(--surface-2)", marginBottom: "0.5rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>{userName}</div>
          <div style={{
            display: "inline-flex", alignItems: "center", padding: "0.15rem 0.5rem",
            borderRadius: 99, background: badge.bg, color: badge.color,
            fontSize: "0.7rem", fontWeight: 700, marginTop: 4, letterSpacing: "0.04em",
          }}>
            {userRole}
          </div>
        </div>
        <button
          onClick={logout} disabled={loggingOut}
          className="btn btn-secondary" style={{ width: "100%", fontSize: "0.8125rem" }}
        >
          {loggingOut ? "Signing out…" : "Sign Out"}
        </button>
      </div>
    </aside>
  );
}