"use client";
import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Party = {
  id: string; name: string; address: string | null;
  gstNumber: string | null; drugLicenseNumber: string | null;
  notes: string | null; isActive: boolean; createdAt: string;
  phones: { id: string; phone: string }[];
  emails: { id: string; email: string }[];
  _count?: { PurchaseBills: number };
};

type LedgerItem = {
  id: string; productId: string; productName: string;
  composition: string | null; pack: string | null;
  batch: string | null; expiry: string | null;
  quantity: number; rate: number;
  mrp: number | null; discount: number | null;
  gstPercent: number | null;
  cgstPercent: number | null; sgstPercent: number | null; igstPercent: number | null;
  taxableAmount: number | null;
  cgstAmount: number | null; sgstAmount: number | null; igstAmount: number | null;
};

type LedgerEntry = {
  id: string; invoiceNo: string | null; invoiceDate: string | null;
  createdAt: string; totalAmount: number; runningTotal: number;
  itemCount: number; items: LedgerItem[];
};

type LedgerData = {
  party: {
    id: string; name: string; address: string | null;
    gstNumber: string | null; drugLicenseNumber: string | null;
    phone: string | null; email: string | null;
  };
  entries: LedgerEntry[];
  summary: { billCount: number; totalPurchased: number };
};

const EMPTY = {
  name: "", address: "", gstNumber: "",
  drugLicenseNumber: "", notes: "",
  phone: "", email: "",
};

// ── Tally-style Ledger Overlay ────────────────────────────────────────────────
function LedgerOverlay({ partyId, partyName, onClose }: { partyId: string; partyName: string; onClose: () => void }) {
  const [data,    setData]    = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      setLoading(true); setErr("");
      const res  = await fetch(`/api/parties/${partyId}/ledger`);
      const json = await res.json();
      if (!res.ok) { setErr(json?.error || "Failed to load ledger"); setLoading(false); return; }
      setData(json);
      setLoading(false);
    }
    load();
  }, [partyId]);

  function toggleRow(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function fmt(n: number) {
    return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtDate(s: string | null) {
    if (!s) return "—";
    return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "stretch",
    }}>
      {/* Backdrop close */}
      <div style={{ flex: 1 }} onClick={onClose} />

      {/* Panel */}
      <div style={{
        width: "min(1100px, 95vw)", background: "var(--surface-1)",
        borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* ── Header ── */}
        <div style={{
          padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: "1rem", position: "sticky", top: 0,
          background: "var(--surface-1)", zIndex: 10,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>{partyName}</h2>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Purchase Ledger</span>
            </div>
            {data && (
              <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.8rem", flexWrap: "wrap" }}>
                {data.party.gstNumber && (
                  <span style={{ color: "var(--text-secondary)" }}>
                    GST: <strong style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>{data.party.gstNumber}</strong>
                  </span>
                )}
                {data.party.phone && <span style={{ color: "var(--text-secondary)" }}>📞 {data.party.phone}</span>}
                {data.party.address && <span style={{ color: "var(--text-muted)", maxWidth: 300 }}>📍 {data.party.address}</span>}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.5rem", cursor: "pointer", lineHeight: 1, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* ── Summary bar ── */}
        {data && (
          <div style={{
            display: "flex", gap: "0", borderBottom: "1px solid var(--border)",
            background: "var(--surface-2)",
          }}>
            {[
              { label: "Total Bills", value: data.summary.billCount.toString(), color: "var(--text-primary)" },
              { label: "Total Purchased", value: fmt(data.summary.totalPurchased), color: "#6ee7b7" },
              { label: "Avg per Bill", value: data.summary.billCount > 0 ? fmt(data.summary.totalPurchased / data.summary.billCount) : "—", color: "var(--text-secondary)" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ flex: 1, padding: "0.875rem 1.5rem", borderRight: "1px solid var(--border)" }}>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>{label}</div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Body ── */}
        <div style={{ flex: 1, padding: "0" }}>
          {loading ? (
            <div style={{ padding: "2rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8 }} />)}
            </div>
          ) : err ? (
            <div className="alert alert-error" style={{ margin: "1.5rem" }}>{err}</div>
          ) : !data || data.entries.length === 0 ? (
            <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", opacity: 0.4 }}>📄</div>
              <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>No purchase bills found</div>
              <div style={{ fontSize: "0.8rem" }}>Bills are created automatically when you upload a purchase bill from this party.</div>
            </div>
          ) : (
            <div>
              {/* ── Ledger table header ── */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "120px 130px 1fr 60px 120px 120px 130px 40px",
                padding: "0.5rem 1.5rem",
                borderBottom: "2px solid var(--border)",
                fontSize: "0.68rem", fontWeight: 700,
                color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
                background: "var(--surface-2)",
                position: "sticky", top: "calc(var(--header-h, 120px))",
              }}>
                <span>Date</span>
                <span>Invoice No</span>
                <span>Particulars</span>
                <span style={{ textAlign: "right" }}>Items</span>
                <span style={{ textAlign: "right" }}>Taxable</span>
                <span style={{ textAlign: "right" }}>GST</span>
                <span style={{ textAlign: "right" }}>Amount (Dr)</span>
                <span></span>
              </div>

              {/* ── Ledger rows ── */}
              {data.entries.map((entry, idx) => {
                const isOpen = expanded.has(entry.id);
                const taxable = entry.items.reduce((s, i) => s + (i.taxableAmount ?? (i.rate * i.quantity)), 0);
                const gstAmt  = entry.items.reduce((s, i) => s + (i.cgstAmount ?? 0) + (i.sgstAmount ?? 0) + (i.igstAmount ?? 0), 0);

                return (
                  <div key={entry.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    {/* Main row */}
                    <div
                      onClick={() => toggleRow(entry.id)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "120px 130px 1fr 60px 120px 120px 130px 40px",
                        padding: "0.75rem 1.5rem",
                        alignItems: "center",
                        cursor: "pointer",
                        background: isOpen ? "rgba(99,102,241,0.06)" : idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)"; }}
                    >
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {fmtDate(entry.invoiceDate ?? entry.createdAt)}
                      </span>
                      <span style={{ fontFamily: "monospace", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        {entry.invoiceNo ?? <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>—</span>}
                      </span>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {entry.items.map(i => i.productName).join(", ")}
                      </span>
                      <span style={{ textAlign: "right", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {entry.itemCount}
                      </span>
                      <span style={{ textAlign: "right", fontSize: "0.8rem", fontFamily: "monospace", color: "var(--text-secondary)" }}>
                        {taxable > 0 ? fmt(taxable) : "—"}
                      </span>
                      <span style={{ textAlign: "right", fontSize: "0.8rem", fontFamily: "monospace", color: "var(--text-secondary)" }}>
                        {gstAmt > 0 ? fmt(gstAmt) : "—"}
                      </span>
                      <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: "0.875rem", color: "#6ee7b7" }}>
                        {fmt(entry.totalAmount)}
                      </span>
                      <span style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {isOpen ? "▲" : "▼"}
                      </span>
                    </div>

                    {/* Expanded: line items */}
                    {isOpen && (
                      <div style={{ background: "rgba(59,130,246,0.04)", borderTop: "1px solid var(--border)" }}>
                        {/* Bill meta */}
                        <div style={{
                          padding: "0.6rem 1.5rem 0.5rem",
                          display: "flex", gap: "2rem", fontSize: "0.75rem", color: "var(--text-secondary)",
                          borderBottom: "1px dashed var(--border)",
                          flexWrap: "wrap",
                        }}>
                          <span>Invoice: <strong style={{ fontFamily: "monospace" }}>{entry.invoiceNo ?? "N/A"}</strong></span>
                          <span>Date: <strong>{fmtDate(entry.invoiceDate ?? entry.createdAt)}</strong></span>
                          <span style={{ color: "#6ee7b7", fontWeight: 600 }}>Total: {fmt(entry.totalAmount)}</span>
                        </div>

                        {/* Items table */}
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", fontSize: "0.78rem", borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ background: "rgba(0,0,0,0.2)" }}>
                                {["Product", "Pack", "Batch / Expiry", "Qty", "Rate", "MRP", "Discount", "Taxable", "CGST", "SGST", "IGST", "Total"].map(h => (
                                  <th key={h} style={{
                                    padding: "0.4rem 0.75rem", textAlign: h === "Product" || h === "Pack" || h === "Batch / Expiry" ? "left" : "right",
                                    fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)",
                                    textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap",
                                  }}>
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {entry.items.map((item, ii) => {
                                const lineGst = (item.cgstAmount ?? 0) + (item.sgstAmount ?? 0) + (item.igstAmount ?? 0);
                                const lineTotal = (item.taxableAmount ?? (item.rate * item.quantity)) + lineGst;
                                return (
                                  <tr key={item.id} style={{ borderTop: "1px solid var(--border)" }}>
                                    <td style={{ padding: "0.5rem 0.75rem" }}>
                                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.productName}</div>
                                      {item.composition && <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{item.composition}</div>}
                                    </td>
                                    <td style={{ padding: "0.5rem 0.75rem", color: "var(--text-secondary)" }}>{item.pack ?? "—"}</td>
                                    <td style={{ padding: "0.5rem 0.75rem", fontFamily: "monospace", fontSize: "0.75rem" }}>
                                      <div>{item.batch ?? "—"}</div>
                                      {item.expiry && <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Exp: {item.expiry}</div>}
                                    </td>
                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 600 }}>{item.quantity}</td>
                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: "monospace" }}>₹{item.rate.toFixed(2)}</td>
                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                                      {item.mrp != null ? `₹${item.mrp.toFixed(2)}` : "—"}
                                    </td>
                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "var(--text-secondary)" }}>
                                      {item.discount != null ? `${item.discount}%` : "—"}
                                    </td>
                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: "monospace" }}>
                                      {item.taxableAmount != null ? `₹${item.taxableAmount.toFixed(2)}` : "—"}
                                    </td>
                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: "monospace", color: "var(--text-secondary)", fontSize: "0.72rem" }}>
                                      {item.cgstAmount != null ? `₹${item.cgstAmount.toFixed(2)}` : item.cgstPercent != null ? `${item.cgstPercent}%` : "—"}
                                    </td>
                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: "monospace", color: "var(--text-secondary)", fontSize: "0.72rem" }}>
                                      {item.sgstAmount != null ? `₹${item.sgstAmount.toFixed(2)}` : item.sgstPercent != null ? `${item.sgstPercent}%` : "—"}
                                    </td>
                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: "monospace", color: "var(--text-secondary)", fontSize: "0.72rem" }}>
                                      {item.igstAmount != null ? `₹${item.igstAmount.toFixed(2)}` : item.igstPercent != null ? `${item.igstPercent}%` : "—"}
                                    </td>
                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#6ee7b7" }}>
                                      ₹{lineTotal.toFixed(2)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr style={{ borderTop: "2px solid var(--border)", background: "rgba(0,0,0,0.15)" }}>
                                <td colSpan={7} style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 700, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                                  Bill Total:
                                </td>
                                <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                                  {entry.items.reduce((s, i) => s + (i.taxableAmount ?? (i.rate * i.quantity)), 0) > 0
                                    ? fmt(entry.items.reduce((s, i) => s + (i.taxableAmount ?? (i.rate * i.quantity)), 0))
                                    : "—"}
                                </td>
                                <td colSpan={2} style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                                  {entry.items.reduce((s, i) => s + (i.cgstAmount ?? 0) + (i.sgstAmount ?? 0), 0) > 0
                                    ? fmt(entry.items.reduce((s, i) => s + (i.cgstAmount ?? 0) + (i.sgstAmount ?? 0), 0))
                                    : "—"}
                                </td>
                                <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "var(--text-secondary)" }}>
                                  {entry.items.reduce((s, i) => s + (i.igstAmount ?? 0), 0) > 0
                                    ? fmt(entry.items.reduce((s, i) => s + (i.igstAmount ?? 0), 0))
                                    : "—"}
                                </td>
                                <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: "0.9rem", color: "#6ee7b7" }}>
                                  {fmt(entry.totalAmount)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {/* Running total chip */}
                        <div style={{ padding: "0.5rem 1.5rem 0.6rem", textAlign: "right", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          Cumulative total after this bill:&nbsp;
                          <strong style={{ color: "#fcd34d", fontFamily: "monospace" }}>{fmt(entry.runningTotal)}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ── Grand total footer ── */}
              {data.entries.length > 0 && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "120px 130px 1fr 60px 120px 120px 130px 40px",
                  padding: "0.875rem 1.5rem",
                  background: "var(--surface-2)",
                  borderTop: "2px solid var(--border)",
                  position: "sticky", bottom: 0,
                }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)", gridColumn: "1 / 7" }}>
                    Grand Total ({data.summary.billCount} bills)
                  </span>
                  <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: "1rem", color: "#6ee7b7" }}>
                    {fmt(data.summary.totalPurchased)}
                  </span>
                  <span></span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PartyMasterClient() {
  const [parties,      setParties]      = useState<Party[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [modal,        setModal]        = useState<"add" | "edit" | null>(null);
  const [editing,      setEditing]      = useState<Party | null>(null);
  const [form,         setForm]         = useState({ ...EMPTY });
  const [saving,       setSaving]       = useState(false);
  const [err,          setErr]          = useState("");
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const [ledgerParty,  setLedgerParty]  = useState<{ id: string; name: string } | null>(null);

  async function load() {
    setLoading(true);
    const res  = await fetch("/api/parties");
    const data = await res.json();
    setParties(data.parties ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function openAdd() {
    setForm({ ...EMPTY }); setEditing(null); setErr(""); setModal("add");
  }

  function openEdit(p: Party) {
    setForm({
      name:              p.name,
      address:           p.address           ?? "",
      gstNumber:         p.gstNumber         ?? "",
      drugLicenseNumber: p.drugLicenseNumber ?? "",
      notes:             p.notes             ?? "",
      phone:             p.phones[0]?.phone  ?? "",
      email:             p.emails[0]?.email  ?? "",
    });
    setEditing(p); setErr(""); setModal("edit");
  }

  async function save() {
    if (!form.name.trim()) { setErr("Party name is required"); return; }
    setSaving(true); setErr("");
    const url    = editing ? `/api/parties/${editing.id}` : "/api/parties";
    const method = editing ? "PATCH" : "POST";
    const res    = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data?.error || "Save failed"); setSaving(false); return; }
    setModal(null); setSaving(false); load();
  }

  async function del(id: string) {
    if (!confirm("Deactivate this party?")) return;
    await fetch(`/api/parties/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = parties.filter(p =>
    [p.name, p.gstNumber, p.drugLicenseNumber, p.address,
     ...p.phones.map(x => x.phone), ...p.emails.map(x => x.email)]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1>Party Master</h1>
          <p style={{ marginTop: "0.25rem" }}>{parties.length} suppliers / parties</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, GST, phone…"
            style={{ padding: "0.5rem 0.75rem", minWidth: 220, fontSize: "0.875rem" }}
          />
          <button onClick={openAdd} className="btn btn-primary">+ Add Party</button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
          {search ? "No parties match your search." : "No parties yet. Add one or scan a purchase bill — parties are saved automatically."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {filtered.map(p => (
            <div key={p.id} className="card" style={{ padding: "0.875rem 1rem" }}>
              {/* Main row */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                    {/* Clickable party name → opens ledger */}
                    <button
                      onClick={() => setLedgerParty({ id: p.id, name: p.name })}
                      style={{
                        background: "none", border: "none", padding: 0, cursor: "pointer",
                        fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)",
                        textDecoration: "underline", textDecorationStyle: "dotted",
                        textUnderlineOffset: "3px", textDecorationColor: "var(--text-muted)",
                      }}
                    >
                      {p.name}
                    </button>
                    {p._count?.PurchaseBills
                      ? <span className="badge badge-blue" style={{ fontSize: "0.65rem" }}>{p._count.PurchaseBills} bills</span>
                      : <span className="badge badge-gray" style={{ fontSize: "0.65rem" }}>No bills</span>}
                    {!p.isActive && <span className="badge" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", fontSize: "0.65rem" }}>Inactive</span>}
                  </div>

                  {/* Key details inline */}
                  <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    {p.gstNumber && (
                      <span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>GST </span>
                        <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--text-primary)" }}>{p.gstNumber}</span>
                      </span>
                    )}
                    {p.drugLicenseNumber && (
                      <span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>DL </span>
                        <span style={{ fontFamily: "monospace" }}>{p.drugLicenseNumber}</span>
                      </span>
                    )}
                    {p.phones[0] && <span>📞 {p.phones[0].phone}</span>}
                    {p.emails[0] && <span>✉ {p.emails[0].email}</span>}
                    {p.address && (
                      <span style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        📍 {p.address}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "0.375rem", alignItems: "center", flexShrink: 0 }}>
                  <button
                    onClick={() => setLedgerParty({ id: p.id, name: p.name })}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.75rem" }}
                  >
                    📒 Ledger
                  </button>
                  <button
                    onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.75rem" }}
                  >
                    {expanded === p.id ? "▲ Less" : "▼ More"}
                  </button>
                  <button onClick={() => openEdit(p)} className="btn btn-secondary btn-sm">Edit</button>
                  <button
                    onClick={() => del(p.id)}
                    className="btn btn-sm"
                    style={{ color: "#f87171", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {expanded === p.id && (
                <div style={{
                  marginTop: "0.75rem", paddingTop: "0.75rem",
                  borderTop: "1px solid var(--border)",
                  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "0.75rem", fontSize: "0.8rem",
                }}>
                  <div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>PARTY ID</div>
                    <div style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "var(--text-secondary)" }}>{p.id}</div>
                  </div>
                  {p.gstNumber && (
                    <div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>GST NUMBER</div>
                      <div style={{ fontFamily: "monospace", fontWeight: 600 }}>{p.gstNumber}</div>
                    </div>
                  )}
                  {p.drugLicenseNumber && (
                    <div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>DRUG LICENSE</div>
                      <div style={{ fontFamily: "monospace" }}>{p.drugLicenseNumber}</div>
                    </div>
                  )}
                  {p.phones.map(ph => (
                    <div key={ph.id}>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>PHONE</div>
                      <div>{ph.phone}</div>
                    </div>
                  ))}
                  {p.emails.map(em => (
                    <div key={em.id}>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>EMAIL</div>
                      <div>{em.email}</div>
                    </div>
                  ))}
                  {p.address && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>ADDRESS</div>
                      <div>{p.address}</div>
                    </div>
                  )}
                  {p.notes && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>NOTES</div>
                      <div>{p.notes}</div>
                    </div>
                  )}
                  <div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>ADDED ON</div>
                    <div>{new Date(p.createdAt).toLocaleDateString("en-IN")}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth: 560, width: "100%" }}>
            <div className="modal-header">
              <h3>{modal === "add" ? "Add Party" : "Edit Party"}</h3>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.25rem", cursor: "pointer" }}>✕</button>
            </div>
            <div className="modal-body">
              {err && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{err}</div>}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Party / Company Name *</label>
                  <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. GUPTA DRUG AGENCIES" />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>GST Number</label>
                  <input value={form.gstNumber} onChange={e => set("gstNumber", e.target.value)} placeholder="27XXXXX" style={{ fontFamily: "monospace" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Drug License Number</label>
                  <input value={form.drugLicenseNumber} onChange={e => set("drugLicenseNumber", e.target.value)} placeholder="20B-MH-NG2-XXXXX" style={{ fontFamily: "monospace" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Phone</label>
                  <input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="Phone number" />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Email</label>
                  <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@example.com" />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Address</label>
                  <input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Full address" />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Notes</label>
                  <input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any notes" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setModal(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn btn-primary">
                {saving ? "Saving…" : modal === "add" ? "Add Party" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Overlay */}
      {ledgerParty && (
        <LedgerOverlay
          partyId={ledgerParty.id}
          partyName={ledgerParty.name}
          onClose={() => setLedgerParty(null)}
        />
      )}
    </div>
  );
}
