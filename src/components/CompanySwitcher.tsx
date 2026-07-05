"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Settings } from "lucide-react";

type Company = { id: string; name: string; gstin: string; invoicePrefix: string; logoB64: string };

export default function CompanySwitcher({ activeCompanyId, isAdmin }: { activeCompanyId: string; isAdmin: boolean }) {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/companies").then(r => r.json()).then(d => setCompanies(d.companies ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const active = companies.find(c => c.id === activeCompanyId) ?? companies[0] ?? null;

  async function switchTo(id: string) {
    if (id === activeCompanyId) { setOpen(false); return; }
    setSwitching(id);
    try {
      const res = await fetch("/api/companies/switch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: id }),
      });
      if (res.ok) { setOpen(false); router.refresh(); window.location.reload(); }
    } finally {
      setSwitching(null);
    }
  }

  const logo = active?.logoB64 && active.logoB64.length > 20 ? active.logoB64 : "/logo.png";

  return (
    <div ref={rootRef} style={{ position: "relative", padding: "1.1rem 1rem", borderBottom: "1px solid var(--border)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left",
        }}
        title="Switch company"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="logo" style={{ width: 34, height: 34, objectFit: "contain", flexShrink: 0, borderRadius: 6 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {active?.name ?? "UNNATI PHARMAX"}
          </div>
          <div style={{ fontSize: "0.64rem", color: "var(--text-muted)", marginTop: 2 }}>
            {companies.length > 1 ? "Tap to switch company" : "ERP System"}
          </div>
        </div>
        <ChevronsUpDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 8, right: 8, zIndex: 300, marginTop: -4,
          background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)", overflow: "hidden",
        }}>
          <div style={{ padding: "6px 10px", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
            Companies
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {companies.map(c => {
              const isActive = c.id === activeCompanyId;
              return (
                <button key={c.id} onClick={() => switchTo(c.id)} disabled={!!switching}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                    background: isActive ? "var(--surface-2)" : "transparent", border: "none",
                    cursor: switching ? "wait" : "pointer", textAlign: "left",
                  }}>
                  <Building2 size={15} style={{ color: isActive ? "#f3b942" : "var(--text-muted)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                    {c.gstin && <div style={{ fontSize: "0.64rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{c.gstin}</div>}
                  </div>
                  {switching === c.id ? <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>…</span>
                    : isActive ? <Check size={15} style={{ color: "#047857", flexShrink: 0 }} /> : null}
                </button>
              );
            })}
          </div>
          {isAdmin && (
            <a href="/dashboard/companies" onClick={() => setOpen(false)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderTop: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: "0.78rem", textDecoration: "none" }}>
              <Settings size={14} /> Manage companies
            </a>
          )}
        </div>
      )}
    </div>
  );
}
