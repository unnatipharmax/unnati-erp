"use client";
import { useState, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
type BillRow = {
  id:            string;
  invoiceNo:     string | null;
  invoiceDate:   string | null;
  createdAt:     string;
  partyId:       string;
  partyName:     string;
  partyGst:      string | null;
  products:      string;
  billAmount:    number;
  paidAmount:    number;
  creditAdjusted: number;
  outstanding:   number;
};

type Summary = {
  billCount:          number;
  totalBillAmount:    number;
  totalPaid:          number;
  totalCreditAdjusted: number;
  totalOutstanding:   number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

// ── Quick range presets ────────────────────────────────────────────────────────
function getPreset(key: string): { from: string; to: string } {
  const now   = new Date();
  const y     = now.getFullYear();
  const m     = now.getMonth();

  switch (key) {
    case "this_month":
      return { from: isoDate(new Date(y, m, 1)), to: isoDate(new Date(y, m + 1, 0)) };
    case "last_month":
      return { from: isoDate(new Date(y, m - 1, 1)), to: isoDate(new Date(y, m, 0)) };
    case "this_quarter": {
      const q = Math.floor(m / 3);
      return { from: isoDate(new Date(y, q * 3, 1)), to: isoDate(new Date(y, q * 3 + 3, 0)) };
    }
    case "last_quarter": {
      const q = Math.floor(m / 3) - 1;
      const qy = q < 0 ? y - 1 : y;
      const qq = q < 0 ? 3 : q;
      return { from: isoDate(new Date(qy, qq * 3, 1)), to: isoDate(new Date(qy, qq * 3 + 3, 0)) };
    }
    case "this_year":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "last_year":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case "this_fy": {
      // Indian FY: Apr 1 – Mar 31
      const fyStart = m >= 3 ? y : y - 1;
      return { from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31` };
    }
    default:
      return { from: isoDate(new Date(y, m, 1)), to: isoDate(new Date(y, m + 1, 0)) };
  }
}

const PRESETS = [
  { key: "this_month",   label: "This Month"   },
  { key: "last_month",   label: "Last Month"   },
  { key: "this_quarter", label: "This Quarter" },
  { key: "last_quarter", label: "Last Quarter" },
  { key: "this_fy",      label: "This FY"      },
  { key: "this_year",    label: "This Year"    },
  { key: "last_year",    label: "Last Year"    },
];

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PurchaseBillsReport() {
  const defaultRange = getPreset("this_month");
  const [view,       setView]       = useState<"bills" | "credit_notes">("bills");
  const [from,       setFrom]       = useState(defaultRange.from);
  const [to,         setTo]         = useState(defaultRange.to);
  const [rows,       setRows]       = useState<BillRow[]>([]);
  const [summary,    setSummary]    = useState<Summary | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [err,        setErr]        = useState("");
  const [search,     setSearch]     = useState("");
  const [activePreset, setActivePreset] = useState("this_month");

  const load = useCallback(async (f: string, t: string, v?: "bills" | "credit_notes") => {
    setLoading(true); setErr("");
    const activeView = v ?? view;
    try {
      const url = activeView === "credit_notes"
        ? `/api/purchase-bills-report?from=${f}&to=${t}&type=credit_note`
        : `/api/purchase-bills-report?from=${f}&to=${t}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (!res.ok) { setErr(data?.error || "Failed to load"); return; }
      setRows(data.rows ?? []);
      setSummary(data.summary ?? null);
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => { load(from, to); }, []);

  function switchView(v: "bills" | "credit_notes") {
    setView(v);
    setRows([]); setSummary(null);
    load(from, to, v);
  }

  function applyPreset(key: string) {
    const range = getPreset(key);
    setFrom(range.from); setTo(range.to);
    setActivePreset(key);
    load(range.from, range.to);
  }

  function applyCustom() {
    setActivePreset("");
    load(from, to);
  }

  const filtered = rows.filter(r =>
    [r.partyName, r.invoiceNo, r.partyGst, r.products]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  // Column widths — bills: 9 cols, credit notes: 8 cols (no "outstanding" separate from remaining)
  const COL = view === "credit_notes"
    ? "50px 120px 1fr 130px 120px 120px 110px 110px"
    : "50px 120px 1fr 130px 120px 120px 110px 110px 110px";

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1>{view === "credit_notes" ? "Credit Notes Report" : "Credit Purchase Bill Report"}</h1>
        <p style={{ marginTop: "0.25rem", color: "var(--text-secondary)" }}>
          {view === "credit_notes" ? "All credit notes issued to suppliers" : "All purchase bills with outstanding credit amounts"}
        </p>
      </div>

      {/* ── View Switcher ── */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {([["bills", "📋 Purchase Bills"], ["credit_notes", "🧾 Credit Notes"]] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => switchView(v)}
            className="btn btn-sm"
            style={{
              fontSize: "0.82rem", fontWeight: 600, padding: "0.4rem 1rem",
              background: view === v ? "rgba(99,102,241,0.2)" : "var(--surface-2)",
              color:      view === v ? "#818cf8" : "var(--text-secondary)",
              border:     view === v ? "1px solid #6366f1" : "1px solid var(--border)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="card" style={{ padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
        {/* Quick presets */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.875rem" }}>
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className="btn btn-sm"
              style={{
                fontSize: "0.75rem",
                background: activePreset === p.key ? "rgba(99,102,241,0.2)" : "var(--surface-2)",
                color:      activePreset === p.key ? "#818cf8" : "var(--text-secondary)",
                border:     activePreset === p.key ? "1px solid #6366f1" : "1px solid var(--border)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: 3 }}>From</label>
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setActivePreset(""); }} style={{ fontSize: "0.85rem" }} />
          </div>
          <div>
            <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: 3 }}>To</label>
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setActivePreset(""); }} style={{ fontSize: "0.85rem" }} />
          </div>
          <button onClick={applyCustom} className="btn btn-primary" style={{ fontSize: "0.85rem" }}>
            Apply
          </button>
          <div style={{ marginLeft: "auto" }}>
            <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Search</label>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Party, invoice, product…"
              style={{ fontSize: "0.85rem", minWidth: 220 }}
            />
          </div>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
          {(view === "credit_notes" ? [
            { label: "Total CNs",          value: `${summary.billCount}`,           color: "var(--text-primary)", mono: false },
            { label: "Total CN Amount",    value: fmt(summary.totalBillAmount),      color: "#fb923c" },
            { label: "Applied to Bills",   value: fmt((summary as any).totalApplied ?? 0), color: "#6ee7b7" },
            { label: "Remaining Balance",  value: fmt((summary as any).totalRemaining ?? 0), color: "#f87171" },
          ] : [
            { label: "Total Bills",        value: `${summary.billCount}`,            color: "var(--text-primary)", mono: false },
            { label: "Total Bill Amount",  value: fmt(summary.totalBillAmount),       color: "#93c5fd" },
            { label: "Total Paid",         value: fmt(summary.totalPaid),             color: "#6ee7b7" },
            { label: "Credit Note Adj.",   value: fmt(summary.totalCreditAdjusted),   color: "#fb923c" },
            { label: "Total Outstanding",  value: fmt(summary.totalOutstanding),      color: "#f87171" },
          ]).map(({ label, value, color, mono }) => (
            <div key={label} className="card" style={{ padding: "0.875rem 1rem" }}>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color, fontFamily: mono === false ? undefined : "monospace" }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      {err && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{err}</div>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Table header */}
        <div style={{
          display: "grid", gridTemplateColumns: COL,
          padding: "0.5rem 1rem",
          background: "var(--surface-2)",
          borderBottom: "2px solid var(--border)",
          fontSize: "0.68rem", fontWeight: 700,
          color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          <span>#</span>
          <span>Date</span>
          <span>Party / {view === "credit_notes" ? "CN No." : "Invoice"}</span>
          <span>Products</span>
          <span style={{ textAlign: "right" }}>{view === "credit_notes" ? "CN Amount" : "Bill Amt"}</span>
          {view === "credit_notes" ? (
            <>
              <span style={{ textAlign: "right" }}>Applied</span>
              <span style={{ textAlign: "right" }}>Remaining</span>
            </>
          ) : (
            <>
              <span style={{ textAlign: "right" }}>Paid</span>
              <span style={{ textAlign: "right" }}>CN Adj.</span>
              <span style={{ textAlign: "right" }}>Outstanding</span>
            </>
          )}
          <span style={{ textAlign: "right" }}>Status</span>
        </div>

        {loading ? (
          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 6 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem", opacity: 0.4 }}>📋</div>
            <div style={{ fontWeight: 600 }}>No bills found</div>
            <div style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
              {search ? "No bills match your search." : "No purchase bills in this date range."}
            </div>
          </div>
        ) : (
          <>
            {filtered.map((row, idx) => {
              const isCN = view === "credit_notes";
              const applied   = (row as any).applied ?? 0;
              const remaining = (row as any).remaining ?? 0;
              const isCleared = isCN ? remaining < 0.01 : row.outstanding < 0.01;
              const isPartial = !isCleared && (isCN ? applied > 0.01 : row.paidAmount > 0.01);

              return (
                <div
                  key={row.id}
                  style={{
                    display: "grid", gridTemplateColumns: COL,
                    padding: "0.65rem 1rem",
                    alignItems: "center",
                    borderBottom: "1px solid var(--border)",
                    background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)",
                  }}
                >
                  {/* # */}
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{idx + 1}</span>

                  {/* Date */}
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {fmtDate(row.invoiceDate ?? row.createdAt)}
                  </span>

                  {/* Party / Invoice or CN No. */}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)" }}>{row.partyName}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                      {row.invoiceNo ?? <span style={{ fontStyle: "italic" }}>{isCN ? "No CN No." : "No Invoice No."}</span>}
                      {row.partyGst && <span style={{ marginLeft: 8 }}>GST: {row.partyGst}</span>}
                    </div>
                  </div>

                  {/* Products */}
                  <span style={{
                    fontSize: "0.75rem", color: "var(--text-secondary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    maxWidth: 140,
                  }} title={row.products}>
                    {row.products || "—"}
                  </span>

                  {/* CN / Bill Amount */}
                  <span style={{ textAlign: "right", fontFamily: "monospace", fontSize: "0.82rem", fontWeight: 600, color: isCN ? "#fb923c" : "#93c5fd" }}>
                    {fmt(row.billAmount)}
                  </span>

                  {isCN ? (
                    <>
                      {/* Applied */}
                      <span style={{ textAlign: "right", fontFamily: "monospace", fontSize: "0.82rem", color: applied > 0 ? "#6ee7b7" : "var(--text-muted)" }}>
                        {applied > 0 ? fmt(applied) : "—"}
                      </span>
                      {/* Remaining */}
                      <span style={{ textAlign: "right", fontFamily: "monospace", fontSize: "0.82rem", fontWeight: 700, color: isCleared ? "#6ee7b7" : "#f87171" }}>
                        {isCleared ? "—" : fmt(remaining)}
                      </span>
                    </>
                  ) : (
                    <>
                      {/* Paid */}
                      <span style={{ textAlign: "right", fontFamily: "monospace", fontSize: "0.82rem", color: row.paidAmount > 0 ? "#6ee7b7" : "var(--text-muted)" }}>
                        {row.paidAmount > 0 ? fmt(row.paidAmount) : "—"}
                      </span>
                      {/* CN Adjusted */}
                      <span style={{ textAlign: "right", fontFamily: "monospace", fontSize: "0.82rem", color: row.creditAdjusted > 0 ? "#fb923c" : "var(--text-muted)" }}>
                        {row.creditAdjusted > 0 ? fmt(row.creditAdjusted) : "—"}
                      </span>
                      {/* Outstanding */}
                      <span style={{ textAlign: "right", fontFamily: "monospace", fontSize: "0.82rem", fontWeight: 700, color: isCleared ? "#6ee7b7" : "#f87171" }}>
                        {isCleared ? "—" : fmt(row.outstanding)}
                      </span>
                    </>
                  )}

                  {/* Status badge */}
                  <div style={{ textAlign: "right" }}>
                    <span style={{
                      fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "0.04em", padding: "2px 7px", borderRadius: 4,
                      background: isCleared
                        ? "rgba(110,231,183,0.12)"
                        : isPartial
                          ? "rgba(251,146,60,0.12)"
                          : "rgba(248,113,113,0.12)",
                      color: isCleared ? "#6ee7b7" : isPartial ? "#fb923c" : "#f87171",
                    }}>
                      {isCleared ? (isCN ? "Fully Used" : "Cleared") : isPartial ? (isCN ? "Partial" : "Partial") : (isCN ? "Unused" : "Unpaid")}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* ── Totals footer ── */}
            <div style={{
              display: "grid", gridTemplateColumns: COL,
              padding: "0.75rem 1rem",
              background: "var(--surface-2)",
              borderTop: "2px solid var(--border)",
              position: "sticky", bottom: 0,
            }}>
              <span></span>
              <span></span>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                {filtered.length} {view === "credit_notes" ? "credit note" : "bill"}{filtered.length !== 1 ? "s" : ""}
              </span>
              <span></span>
              <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: view === "credit_notes" ? "#fb923c" : "#93c5fd", fontSize: "0.88rem" }}>
                {fmt(filtered.reduce((s, r) => s + r.billAmount, 0))}
              </span>
              {view === "credit_notes" ? (
                <>
                  <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#6ee7b7", fontSize: "0.88rem" }}>
                    {fmt(filtered.reduce((s, r) => s + ((r as any).applied ?? 0), 0))}
                  </span>
                  <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#f87171", fontSize: "0.88rem" }}>
                    {fmt(filtered.reduce((s, r) => s + ((r as any).remaining ?? 0), 0))}
                  </span>
                </>
              ) : (
                <>
                  <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#6ee7b7", fontSize: "0.88rem" }}>
                    {fmt(filtered.reduce((s, r) => s + r.paidAmount, 0))}
                  </span>
                  <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#fb923c", fontSize: "0.88rem" }}>
                    {fmt(filtered.reduce((s, r) => s + r.creditAdjusted, 0))}
                  </span>
                  <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#f87171", fontSize: "0.88rem" }}>
                    {fmt(filtered.reduce((s, r) => s + r.outstanding, 0))}
                  </span>
                </>
              )}
              <span></span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
