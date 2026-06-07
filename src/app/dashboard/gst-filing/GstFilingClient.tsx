"use client";
import { useState } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────
function ymd(d: Date) { return d.toISOString().split("T")[0]; }
function monthRange(year: number, month: number) {
  // month: 0-11
  return { from: ymd(new Date(year, month, 1)), to: ymd(new Date(year, month + 1, 0)) };
}
function quarterRange(year: number, q: number) {
  // q: 0-3 → financial quarters not assumed; calendar quarters
  const startMonth = q * 3;
  return { from: ymd(new Date(year, startMonth, 1)), to: ymd(new Date(year, startMonth + 3, 0)) };
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// SOP field coverage — what the export already pulls vs. what's missing.
const COVERAGE: { module: string; covered: string[]; missing: string[] }[] = [
  {
    module: "Purchase / GSTR-2B (ITC)",
    covered: ["Vendor name", "Vendor GSTIN", "Invoice no.", "Invoice date", "Taxable amount", "CGST / SGST / IGST", "Total amount", "ITC"],
    missing: ["GRN no.", "Payment terms / due date", "Approved by"],
  },
  {
    module: "Sales / GSTR-1 (Exports)",
    covered: ["Invoice no.", "Invoice date", "Customer", "Country", "Currency", "FC value", "Exchange rate", "INR value", "Output tax (0, LUT)"],
    missing: ["Per-item HSN breakup in sheet", "Customer GSTIN (export = N/A)"],
  },
  {
    module: "GSTR-3B Summary",
    covered: ["Output tax (zero-rated)", "ITC: IGST / CGST / SGST", "Total ITC", "Net payable / carry-forward"],
    missing: [],
  },
  {
    module: "Expenses",
    covered: ["Date", "Category", "Description", "Payment mode", "Amount", "Vendor name & GSTIN", "Bill no.", "GST % / GST amount", "ITC eligible flag"],
    missing: ["Approved by / approval workflow"],
  },
];

export default function GstFilingClient() {
  const now = new Date();
  const [mode, setMode] = useState<"month" | "quarter" | "custom">("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3));
  const [customFrom, setCustomFrom] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [customTo, setCustomTo] = useState(ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [downloading, setDownloading] = useState(false);
  const [err, setErr] = useState("");

  function currentRange() {
    if (mode === "month") return monthRange(year, month);
    if (mode === "quarter") return quarterRange(year, quarter);
    return { from: customFrom, to: customTo };
  }

  async function download() {
    setErr("");
    const { from, to } = currentRange();
    if (new Date(from) > new Date(to)) { setErr("'From' date must be before 'To' date."); return; }
    setDownloading(true);
    try {
      const res = await fetch(`/api/gst/export?from=${from}&to=${to}`);
      if (!res.ok) {
        let msg = `Export failed (${res.status})`;
        try { const j = await res.json(); msg = j?.error || msg; } catch { /* binary */ }
        setErr(msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GST-Filing_${from}_to_${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setDownloading(false);
    }
  }

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];
  const range = currentRange();

  const inputStyle: React.CSSProperties = { padding: "0.4rem 0.6rem", fontSize: "0.85rem", borderRadius: 8, border: "1px solid var(--border)" };

  return (
    <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 1000 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>GST Filing</h1>
        <p style={{ marginTop: "0.25rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
          Generate a ready-to-file workbook — GSTR-3B summary, GSTR-2B (purchase / ITC), GSTR-1 (exports) and expenses — for your accountant.
        </p>
      </div>

      {/* Period picker */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.875rem" }}>Select Period</div>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          {(["month", "quarter", "custom"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`btn btn-sm ${mode === m ? "btn-primary" : "btn-secondary"}`}
              style={{ textTransform: "capitalize" }}>
              {m === "month" ? "Monthly" : m === "quarter" ? "Quarterly" : "Custom Range"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          {mode === "month" && (
            <>
              <select value={month} onChange={e => setMonth(Number(e.target.value))} style={inputStyle}>
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(Number(e.target.value))} style={inputStyle}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          )}
          {mode === "quarter" && (
            <>
              <select value={quarter} onChange={e => setQuarter(Number(e.target.value))} style={inputStyle}>
                {["Q1 (Jan–Mar)", "Q2 (Apr–Jun)", "Q3 (Jul–Sep)", "Q4 (Oct–Dec)"].map((q, i) => <option key={q} value={i}>{q}</option>)}
              </select>
              <select value={year} onChange={e => setYear(Number(e.target.value))} style={inputStyle}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          )}
          {mode === "custom" && (
            <>
              <label style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>From</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={inputStyle} />
              <label style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>To</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={inputStyle} />
            </>
          )}
        </div>

        <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <button onClick={download} disabled={downloading} className="btn btn-primary">
            {downloading ? "Generating…" : "⬇ Download GST Workbook (.xlsx)"}
          </button>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Period: <strong>{new Date(range.from).toLocaleDateString("en-IN")}</strong> → <strong>{new Date(range.to).toLocaleDateString("en-IN")}</strong>
          </span>
        </div>
        {err && <div style={{ marginTop: "0.75rem", color: "#dc2626", fontSize: "0.82rem" }}>{err}</div>}
      </div>

      {/* What's in the workbook */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.25rem" }}>What the workbook contains</div>
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 0, marginBottom: "1rem" }}>
          5 sheets — Cover, GSTR-3B Summary, GSTR-2B Purchases, GSTR-1 Exports, Expenses. Below is how the SOP fields map to your data.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          {COVERAGE.map(c => (
            <div key={c.module} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "0.875rem", background: "var(--surface-1)" }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.5rem" }}>{c.module}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {c.covered.map(f => (
                  <div key={f} style={{ fontSize: "0.76rem", color: "#047857", display: "flex", gap: 6 }}>
                    <span>✓</span><span style={{ color: "var(--text-secondary)" }}>{f}</span>
                  </div>
                ))}
                {c.missing.map(f => (
                  <div key={f} style={{ fontSize: "0.76rem", color: "#dc2626", display: "flex", gap: 6 }}>
                    <span>✕</span><span style={{ color: "var(--text-muted)" }}>{f} <em>(not captured yet)</em></span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          <strong>Note:</strong> Exports are treated as zero-rated under LUT — output GST is 0, so GSTR-3B net is an ITC carry-forward.
          Expense ITC is now included: add GST %, GST amount, vendor GSTIN and tick &ldquo;ITC eligible&rdquo; on an expense (in the Expenses page) and it flows into the GSTR-3B total ITC.
        </div>
      </div>
    </div>
  );
}
