"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Home, Link2, FileText, Users, Package, Settings,
  BookOpen, Box, ClipboardList, Wallet, Tag,
  Bell, RotateCcw, ShoppingCart, BarChart2, Building2, PenLine, Truck, FileSpreadsheet, BookText,
  Menu, X,
} from "lucide-react";
import CompanySwitcher from "./CompanySwitcher";

type Role = "ADMIN" | "MANAGER" | "SALES" | "ACCOUNTS" | "PACKAGING";

type MenuItem = {
  name: string;
  path: string;
  icon: React.ElementType;
  roles: Role[];
};

type Group = {
  label: string;
  items: MenuItem[];
};

const GROUPS: Group[] = [
  {
    label: "",  // no header for top-level Home
    items: [
      { name: "Dashboard", path: "/dashboard", icon: Home, roles: ["ADMIN","MANAGER","SALES","ACCOUNTS","PACKAGING"] },
    ],
  },
  {
    label: "Sales",
    items: [
      { name: "Quotation",         path: "/dashboard/quotation",    icon: ClipboardList, roles: ["ADMIN","MANAGER","SALES"] },
      { name: "Create Order Link", path: "/dashboard/client-forms", icon: Link2,         roles: ["ADMIN","MANAGER","SALES","ACCOUNTS"] },
      { name: "Order Entry",       path: "/dashboard/order-entry",  icon: PenLine,       roles: ["ADMIN","MANAGER","SALES"] },
      { name: "Price List",        path: "/dashboard/price-list",   icon: Tag,           roles: ["ADMIN","MANAGER","SALES"] },
    ],
  },
  {
    label: "Packaging",
    items: [
      { name: "Packaging",         path: "/dashboard/packaging",          icon: Box,        roles: ["ADMIN","MANAGER","PACKAGING"] },
      { name: "Edit Invoices",     path: "/dashboard/invoices",           icon: FileText,   roles: ["ADMIN","MANAGER"] },
      { name: "Export Returns",    path: "/dashboard/returns",            icon: RotateCcw,  roles: ["ADMIN","MANAGER"] },
      { name: "Local Courier Sheet", path: "/dashboard/anjani-courier",   icon: Truck,      roles: ["ADMIN","MANAGER","PACKAGING","ACCOUNTS"] },
      { name: "Daily Order Book",    path: "/dashboard/daily-order-book", icon: BookText,   roles: ["ADMIN","MANAGER","PACKAGING","ACCOUNTS"] },
      { name: "Dosage Reminders",  path: "/dashboard/dosage-reminders",   icon: Bell,       roles: ["ADMIN","MANAGER"] },
    ],
  },
  {
    label: "Accounts",
    items: [
      { name: "Ledger",      path: "/dashboard/ledger",      icon: BookOpen,        roles: ["ADMIN","MANAGER","ACCOUNTS"] },
      { name: "Expenses",    path: "/dashboard/expenses",    icon: Wallet,          roles: ["ADMIN","MANAGER","ACCOUNTS"] },
      { name: "GST Filing",  path: "/dashboard/gst-filing",  icon: FileSpreadsheet, roles: ["ADMIN","MANAGER","ACCOUNTS"] },
    ],
  },
  {
    label: "Inventory",
    items: [
      { name: "Purchase Bills",  path: "/dashboard/purchase-bills",        icon: ShoppingCart, roles: ["ADMIN","MANAGER","ACCOUNTS","PACKAGING"] },
      { name: "Purchase Report", path: "/dashboard/purchase-bills-report", icon: BarChart2,    roles: ["ADMIN","MANAGER","ACCOUNTS"] },
    ],
  },
  {
    label: "Masters",
    items: [
      { name: "Products",  path: "/dashboard/product-master", icon: Package,    roles: ["ADMIN","MANAGER","PACKAGING"] },
      { name: "Clients",   path: "/dashboard/client-master",  icon: Users,      roles: ["ADMIN","MANAGER"] },
      { name: "Suppliers", path: "/dashboard/party",          icon: Building2,  roles: ["ADMIN","MANAGER"] },
    ],
  },
  {
    label: "Admin",
    items: [
      { name: "Companies",        path: "/dashboard/companies", icon: Building2,    roles: ["ADMIN"] },
      { name: "Reports & Backup", path: "/dashboard/reports", icon: ClipboardList, roles: ["ADMIN","MANAGER","ACCOUNTS"] },
      { name: "Setup",            path: "/dashboard/setup",   icon: Settings,      roles: ["ADMIN"] },
    ],
  },
];

const ROLE_BADGE: Record<Role, { bg: string; color: string }> = {
  ADMIN:     { bg: "rgba(229,152,26,0.16)", color: "#f3b942" },
  MANAGER:   { bg: "rgba(16,185,129,0.15)", color: "#047857" },
  SALES:     { bg: "rgba(56,189,248,0.15)", color: "#7dd3fc" },
  ACCOUNTS:  { bg: "rgba(156,163,175,0.15)", color: "#c2c8d4" },
  PACKAGING: { bg: "rgba(168,85,247,0.15)",  color: "#7c3aed" },
};

export default function Sidebar({ userName, userRole, activeCompanyId }: { userName: string; userRole: Role; activeCompanyId: string }) {
  const pathname    = usePathname();
  const router      = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [open, setOpen] = useState(false);   // mobile drawer open state
  const badge = ROLE_BADGE[userRole];

  // Close the mobile drawer whenever the route changes
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    if (open) document.body.classList.add("nav-open");
    else document.body.classList.remove("nav-open");
    return () => document.body.classList.remove("nav-open");
  }, [open]);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  // Filter groups: only show groups that have at least one accessible item
  const visibleGroups = GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => i.roles.includes(userRole)) }))
    .filter(g => g.items.length > 0);

  return (
    <>
      {/* Hamburger — only visible on mobile (see globals.css .nav-hamburger) */}
      <button
        className="nav-hamburger"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <Menu size={20} strokeWidth={2.2} />
      </button>

      {/* Backdrop behind the drawer on mobile */}
      {open && <div className="nav-backdrop" onClick={() => setOpen(false)} />}

    <aside
      className={`app-sidebar${open ? " open" : ""}`}
      style={{
        width: 220, minHeight: "100vh", flexShrink: 0,
        background: "var(--surface-1)", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Close button — only shown inside the mobile drawer */}
      <button
        className="nav-close"
        aria-label="Close menu"
        onClick={() => setOpen(false)}
      >
        <X size={18} strokeWidth={2.2} />
      </button>

      {/* Company switcher (replaces the static logo header) */}
      <CompanySwitcher activeCompanyId={activeCompanyId} isAdmin={userRole === "ADMIN"} />

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0.5rem 0.6rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: 0 }}>
        {visibleGroups.map((group, gi) => (
          <div key={gi} style={{ marginBottom: group.label ? 4 : 2 }}>
            {/* Section header */}
            {group.label && (
              <div style={{
                fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", color: "var(--text-muted)",
                padding: "0.6rem 0.5rem 0.25rem",
                marginTop: gi === 0 ? 0 : 6,
              }}>
                {group.label}
              </div>
            )}
            {/* Items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {group.items.map(item => {
                const Icon   = item.icon;
                const active = pathname === item.path || pathname.startsWith(item.path + "/");
                return (
                  <a
                    key={item.path}
                    href={item.path}
                    className={`nav-link${active ? " active" : ""}`}
                    style={{ fontSize: "0.8rem" }}
                  >
                    <Icon size={14} strokeWidth={2} />
                    {item.name}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User + Logout */}
      <div style={{ padding: "0.75rem", borderTop: "1px solid var(--border)" }}>
        <div style={{ padding: "0.65rem 0.75rem", borderRadius: 10, background: "var(--surface-2)", marginBottom: "0.5rem" }}>
          <div style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--text-primary)" }}>{userName}</div>
          <div style={{
            display: "inline-flex", alignItems: "center",
            padding: "0.15rem 0.5rem", borderRadius: 99,
            background: badge.bg, color: badge.color,
            fontSize: "0.65rem", fontWeight: 700, marginTop: 4, letterSpacing: "0.04em",
          }}>
            {userRole}
          </div>
        </div>
        <button onClick={logout} disabled={loggingOut} className="btn btn-secondary" style={{ width: "100%", fontSize: "0.8rem" }}>
          {loggingOut ? "Signing out…" : "Sign Out"}
        </button>
      </div>
    </aside>
    </>
  );
}
