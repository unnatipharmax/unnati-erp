"use client";
import { useState, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Client = {
  id: string;
  name: string;
  address: string | null;
  gstNumber: string | null;
  drugLicenseNumber: string | null;
  notes: string | null;
  balance: string;
  isActive: boolean;
  createdAt: string;
  phones: { id: string; phone: string }[];
  emails: { id: string; email: string }[];
  _count?: { orders: number };
};

type LedgerEntry = {
  id: string;
  date: string;
  kind: "credit" | "debit" | "order";
  particulars: string;
  credit: number | null;
  debit: number | null;
  balance: number;
  note: string | null;
  orderStatus?: string;
  invoiceNo?: string | null;
  fullName?: string;
  city?: string;
  country?: string;
};

type LedgerData = {
  client: {
    id: string;
    name: string;
    address: string | null;
    gstNumber: string | null;
    drugLicenseNumber: string | null;
    phone: string | null;
    email: string | null;
    balance: number;
  };
  entries: LedgerEntry[];
  summary: {
    orderCount: number;
    totalCredit: number;
    totalDebit: number;
    closingBalance: number;
  };
};

const EMPTY = {
  name: "", address: "", gstNumber: "",
  drugLicenseNumber: "", notes: "", phone: "", email: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_COLOR: Record<string, string> = {
  INITIATED:        "#fcd34d",
  SALES_UPDATED:    "#93c5fd",
  PAYMENT_VERIFIED: "#6ee7b7",
  PACKING:          "#fb923c",
  DISPATCHED:       "#a78bfa",
};

// ── Ledger Tab ─────────────────────────────────────────────────────────────────
function LedgerTab({ data }: { data: LedgerData }) {
  const COL = "110px 1fr 100px 110px 110px 120px";

  if (data.entries.length === 0) {
    return (
      <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--text-muted)" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", opacity: 0.4 }}>📄</div>
        <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>No transactions yet</div>
        <div style={{ fontSize: "0.8rem" }}>Orders placed or balance entries will appear here.</div>
      </div>
    );
  }

  return (
    <div>
      {/* Table header */}
      <div style={{
        display: "grid", gridTemplateColumns: COL,
        padding: "0.5rem 1.25rem",
        borderBottom: "2px solid var(--border)",
        fontSize: "0.68rem", fontWeight: 700,
        color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
        background: "var(--surface-2)",
      }}>
        <span>Date</span>
        <span>Particulars</span>
        <span>Type</span>
        <span style={{ textAlign: "right" }}>Credit (↑)</span>
        <span style={{ textAlign: "right" }}>Debit (↓)</span>
        <span style={{ textAlign: "right" }}>Balance</span>
      </div>

      {/* Opening balance */}
      <div style={{
        display: "grid", gridTemplateColumns: COL,
        padding: "0.55rem 1.25rem",
        borderBottom: "1px solid var(--border)",
        background: "rgba(0,0,0,0.15)",
        fontSize: "0.8rem",
      }}>
        <span style={{ color: "var(--text-muted)" }}>—</span>
        <span style={{ fontStyle: "italic", color: "var(--text-muted)" }}>Opening Balance</span>
        <span></span><span></span><span></span>
        <span style={{ textAlign: "right", fontFamily: "monospace", color: "var(--text-muted)" }}>₹0.00</span>
      </div>

      {data.entries.map((entry, idx) => {
        const isOrder  = entry.kind === "order";
        const isCredit = entry.kind === "credit";

        return (
          <div
            key={entry.id}
            style={{
              display: "grid", gridTemplateColumns: COL,
              padding: "0.6rem 1.25rem",
              alignItems: "center",
              borderBottom: "1px solid var(--border)",
              background: isCredit
                ? "rgba(52,211,153,0.04)"
                : isOrder
                  ? idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)"
                  : "rgba(248,113,113,0.04)",
            }}
          >
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{fmtDate(entry.date)}</span>

            <div>
              <div style={{ fontSize: "0.82rem", color: isCredit ? "#6ee7b7" : isOrder ? "var(--text-secondary)" : "#fca5a5", fontWeight: 500 }}>
                {entry.particulars}
              </div>
              {isOrder && entry.city && (
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  {entry.city}, {entry.country}
                  {entry.invoiceNo && <span style={{ marginLeft: 8, fontFamily: "monospace", color: "#93c5fd" }}>{entry.invoiceNo}</span>}
                </div>
              )}
              {entry.note && !isOrder && (
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontStyle: "italic" }}>{entry.note}</div>
              )}
            </div>

            <span>
              {isOrder && entry.orderStatus ? (
                <span style={{
                  fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.04em", color: STATUS_COLOR[entry.orderStatus] ?? "var(--text-muted)",
                }}>
                  {entry.orderStatus.replace("_", " ")}
                </span>
              ) : (
                <span style={{
                  fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: isCredit ? "#6ee7b7" : "#fca5a5",
                }}>
                  {isCredit ? "CREDIT" : "DEBIT"}
                </span>
              )}
            </span>

            <span style={{
              textAlign: "right", fontFamily: "monospace", fontSize: "0.82rem",
              fontWeight: entry.credit ? 600 : 400,
              color: entry.credit ? "#6ee7b7" : "var(--text-muted)",
            }}>
              {entry.credit != null ? fmt(entry.credit) : "—"}
            </span>

            <span style={{
              textAlign: "right", fontFamily: "monospace", fontSize: "0.82rem",
              fontWeight: entry.debit ? 600 : 400,
              color: entry.debit ? "#fca5a5" : "var(--text-muted)",
            }}>
              {entry.debit != null ? fmt(entry.debit) : "—"}
            </span>

            <span style={{
              textAlign: "right", fontFamily: "monospace", fontSize: "0.82rem", fontWeight: 700,
              color: entry.balance >= 0 ? "#fcd34d" : "#6ee7b7",
            }}>
              {fmt(Math.abs(entry.balance))}
              <span style={{ fontSize: "0.65rem", opacity: 0.7, marginLeft: 3 }}>
                {entry.balance >= 0 ? "Cr" : "Dr"}
              </span>
            </span>
          </div>
        );
      })}

      {/* Closing balance footer */}
      <div style={{
        display: "grid", gridTemplateColumns: COL,
        padding: "0.875rem 1.25rem",
        background: "var(--surface-2)",
        borderTop: "2px solid var(--border)",
        position: "sticky", bottom: 0,
      }}>
        <span></span>
        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)" }}>Closing Balance</span>
        <span></span>
        <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#6ee7b7" }}>
          {fmt(data.summary.totalCredit)}
        </span>
        <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#fca5a5" }}>
          {fmt(data.summary.totalDebit)}
        </span>
        <span style={{
          textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: "0.95rem",
          color: data.summary.closingBalance >= 0 ? "#fcd34d" : "#6ee7b7",
        }}>
          {fmt(Math.abs(data.summary.closingBalance))}
          <span style={{ fontSize: "0.72rem", marginLeft: 3 }}>
            {data.summary.closingBalance >= 0 ? "Cr" : "Dr"}
          </span>
        </span>
      </div>
    </div>
  );
}

// ── Ledger Overlay ─────────────────────────────────────────────────────────────
function LedgerOverlay({
  clientId, clientName, onClose,
}: { clientId: string; clientName: string; onClose: () => void }) {
  const [data,    setData]    = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");

  useEffect(() => {
    setLoading(true); setErr("");
    fetch(`/api/client-master/${clientId}/ledger`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setErr(d.error); } else { setData(d); }
        setLoading(false);
      })
      .catch(() => { setErr("Failed to load"); setLoading(false); });
  }, [clientId]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "stretch",
    }}>
      <div style={{ flex: 1 }} onClick={onClose} />

      <div style={{
        width: "min(1100px, 96vw)", background: "var(--surface-1)",
        borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          padding: "1.1rem 1.5rem 0.75rem", borderBottom: "1px solid var(--border)",
          position: "sticky", top: 0, background: "var(--surface-1)", zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "0.5rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>{clientName}</h2>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 4 }}>
                  Client Ledger
                </span>
              </div>
              {data && (
                <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.78rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                  {data.client.gstNumber && (
                    <span style={{ color: "var(--text-secondary)" }}>
                      GST: <strong style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>{data.client.gstNumber}</strong>
                    </span>
                  )}
                  {data.client.phone && <span style={{ color: "var(--text-secondary)" }}>📞 {data.client.phone}</span>}
                  {data.client.address && <span style={{ color: "var(--text-muted)" }}>📍 {data.client.address}</span>}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.5rem", cursor: "pointer", flexShrink: 0, lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {/* Summary chips */}
          {data && (
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              {[
                { label: "Balance",       value: fmt(Math.abs(data.summary.closingBalance)), color: "#fcd34d" },
                { label: "Total Credits", value: fmt(data.summary.totalCredit),              color: "#6ee7b7" },
                { label: "Total Debits",  value: fmt(data.summary.totalDebit),               color: "#fca5a5" },
                { label: "Orders",        value: `${data.summary.orderCount}`,               color: "var(--text-secondary)" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
                  <span style={{ fontSize: "0.88rem", fontWeight: 700, color, fontFamily: "monospace" }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1 }}>
          {loading ? (
            <div style={{ padding: "2rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />)}
            </div>
          ) : err ? (
            <div className="alert alert-error" style={{ margin: "1.5rem" }}>{err}</div>
          ) : data ? (
            <LedgerTab data={data} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ClientMasterClient() {
  const [clients,      setClients]      = useState<Client[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [modal,        setModal]        = useState<"add" | "edit" | null>(null);
  const [editing,      setEditing]      = useState<Client | null>(null);
  const [form,         setForm]         = useState({ ...EMPTY });
  const [saving,       setSaving]       = useState(false);
  const [err,          setErr]          = useState("");
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const [ledgerClient, setLedgerClient] = useState<{ id: string; name: string } | null>(null);

  async function load() {
    setLoading(true);
    const res  = await fetch("/api/client-master");
    const data = await res.json();
    setClients(data.clients ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function openAdd() { setForm({ ...EMPTY }); setEditing(null); setErr(""); setModal("add"); }

  function openEdit(c: Client) {
    setForm({
      name:              c.name,
      address:           c.address           ?? "",
      gstNumber:         c.gstNumber         ?? "",
      drugLicenseNumber: c.drugLicenseNumber ?? "",
      notes:             c.notes             ?? "",
      phone:             c.phones[0]?.phone  ?? "",
      email:             c.emails[0]?.email  ?? "",
    });
    setEditing(c); setErr(""); setModal("edit");
  }

  async function save() {
    if (!form.name.trim()) { setErr("Client name is required"); return; }
    setSaving(true); setErr("");
    const url    = editing ? `/api/client-master/${editing.id}` : "/api/client-master";
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
    if (!confirm("Deactivate this client?")) return;
    await fetch(`/api/client-master/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = clients.filter(c =>
    [c.name, c.gstNumber, c.drugLicenseNumber, c.address,
     ...c.phones.map(x => x.phone), ...c.emails.map(x => x.email)]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1>Client Master</h1>
          <p style={{ marginTop: "0.25rem" }}>{clients.length} client{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, GST, phone…"
            style={{ padding: "0.5rem 0.75rem", minWidth: 220, fontSize: "0.875rem" }}
          />
          <button onClick={openAdd} className="btn btn-primary">+ Add Client</button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
          {search ? "No clients match your search." : "No clients yet. Add one to get started."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {filtered.map(c => {
            const balance = parseFloat(c.balance);
            return (
              <div key={c.id} className="card" style={{ padding: "0.875rem 1rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                      <button
                        onClick={() => setLedgerClient({ id: c.id, name: c.name })}
                        style={{
                          background: "none", border: "none", padding: 0, cursor: "pointer",
                          fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)",
                          textDecoration: "underline", textDecorationStyle: "dotted",
                          textUnderlineOffset: "3px", textDecorationColor: "var(--text-muted)",
                        }}
                      >
                        {c.name}
                      </button>
                      {c._count?.orders
                        ? <span className="badge badge-blue" style={{ fontSize: "0.65rem" }}>{c._count.orders} order{c._count.orders !== 1 ? "s" : ""}</span>
                        : <span className="badge badge-gray" style={{ fontSize: "0.65rem" }}>No orders</span>}
                      <span style={{
                        fontSize: "0.7rem", fontWeight: 700, fontFamily: "monospace",
                        color: balance >= 0 ? "#fcd34d" : "#6ee7b7",
                        background: balance >= 0 ? "rgba(252,211,77,0.1)" : "rgba(110,231,183,0.1)",
                        padding: "2px 7px", borderRadius: 4,
                      }}>
                        {fmt(Math.abs(balance))} {balance >= 0 ? "Cr" : "Dr"}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                      {c.gstNumber && (
                        <span>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>GST </span>
                          <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--text-primary)" }}>{c.gstNumber}</span>
                        </span>
                      )}
                      {c.drugLicenseNumber && (
                        <span>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>DL </span>
                          <span style={{ fontFamily: "monospace" }}>{c.drugLicenseNumber}</span>
                        </span>
                      )}
                      {c.phones[0] && <span>📞 {c.phones[0].phone}</span>}
                      {c.emails[0] && <span>✉ {c.emails[0].email}</span>}
                      {c.address && (
                        <span style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          📍 {c.address}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.375rem", alignItems: "center", flexShrink: 0 }}>
                    <button onClick={() => setLedgerClient({ id: c.id, name: c.name })} className="btn btn-secondary btn-sm" style={{ fontSize: "0.75rem" }}>
                      📒 Ledger
                    </button>
                    <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="btn btn-secondary btn-sm" style={{ fontSize: "0.75rem" }}>
                      {expanded === c.id ? "▲ Less" : "▼ More"}
                    </button>
                    <button onClick={() => openEdit(c)} className="btn btn-secondary btn-sm">Edit</button>
                    <button
                      onClick={() => del(c.id)}
                      className="btn btn-sm"
                      style={{ color: "#f87171", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Expanded notes */}
                {expanded === c.id && (
                  <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)", fontSize: "0.8rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {c.notes ? (
                      <div><span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>Notes: </span>{c.notes}</div>
                    ) : (
                      <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No additional notes.</div>
                    )}
                    <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
                      Added {fmtDate(c.createdAt)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 500,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div className="card" style={{ width: "min(520px, 96vw)", padding: "1.75rem", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 1.25rem", fontSize: "1rem", fontWeight: 700 }}>
              {modal === "add" ? "Add Client" : "Edit Client"}
            </h2>

            {err && <div className="alert alert-error" style={{ marginBottom: "1rem", fontSize: "0.82rem" }}>{err}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  Client Name <span style={{ color: "#f87171" }}>*</span>
                </label>
                <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. ABC Pharmaceuticals" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>GST Number</label>
                  <input value={form.gstNumber} onChange={e => set("gstNumber", e.target.value)} placeholder="27XXXXX..." style={{ fontFamily: "monospace" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Drug License No.</label>
                  <input value={form.drugLicenseNumber} onChange={e => set("drugLicenseNumber", e.target.value)} placeholder="DL-XXX" style={{ fontFamily: "monospace" }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Phone</label>
                  <input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Email</label>
                  <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="client@example.com" />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Address</label>
                <input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Full address" />
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Notes</label>
                <input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any remarks…" />
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
              <button onClick={save} disabled={saving} className="btn btn-primary">
                {saving ? "Saving…" : modal === "add" ? "Add Client" : "Save Changes"}
              </button>
              <button onClick={() => setModal(null)} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Overlay */}
      {ledgerClient && (
        <LedgerOverlay
          clientId={ledgerClient.id}
          clientName={ledgerClient.name}
          onClose={() => setLedgerClient(null)}
        />
      )}
    </div>
  );
}
