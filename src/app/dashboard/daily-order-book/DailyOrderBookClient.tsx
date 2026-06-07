"use client";
import { useState, useCallback, useEffect } from "react";

type BookingRow = {
  serviceMode: string; date: string; name: string; add1: string; city: string;
  state: string; pincode: string; addrMobile: string; addrEmail: string;
  barcode: string; weight: string; ref: string; country: string;
};

const EMPTY: BookingRow = {
  serviceMode: "EMS", date: "", name: "", add1: "", city: "", state: "",
  pincode: "", addrMobile: "", addrEmail: "", barcode: "", weight: "", ref: "", country: "",
};

const SERVICE_MODES = ["EMS", "ITPS", "RMS", "DHL", "UPS", "CM"];

function todayISO() { return new Date().toISOString().slice(0, 10); }

// Columns shown/edited on screen (the mapped subset; the rest export blank).
const COLS: { key: keyof BookingRow; label: string; w: number; mono?: boolean; ta?: "right" }[] = [
  { key: "serviceMode", label: "Service", w: 90 },
  { key: "name", label: "Name", w: 150 },
  { key: "add1", label: "Address (ADD1)", w: 240 },
  { key: "city", label: "City", w: 110 },
  { key: "state", label: "State", w: 130 },
  { key: "pincode", label: "Pincode", w: 90, mono: true },
  { key: "country", label: "Country", w: 120 },
  { key: "addrMobile", label: "Mobile", w: 110, mono: true },
  { key: "barcode", label: "Barcode (Tracking)", w: 140, mono: true },
  { key: "weight", label: "Weight (g)", w: 90, mono: true, ta: "right" },
  { key: "ref", label: "REF (Value)", w: 90, mono: true, ta: "right" },
];

export default function DailyOrderBookClient() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [err, setErr] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true); setErr("");
    try {
      const res = await fetch(`/api/daily-order-book?date=${d}`);
      const data = await res.json();
      if (!res.ok) { setErr(data?.error || "Failed to load orders"); return; }
      setRows(data.rows ?? []);
      setLoadedFor(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(todayISO()); }, [load]);

  function setCell(i: number, key: keyof BookingRow, val: string) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  }
  function removeRow(i: number) { setRows(prev => prev.filter((_, idx) => idx !== i)); }
  function addRow() { setRows(prev => [...prev, { ...EMPTY, date }]); }

  async function download() {
    setDownloading(true); setErr("");
    try {
      const res = await fetch("/api/daily-order-book/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, rows }),
      });
      if (!res.ok) {
        let msg = `Export failed (${res.status})`;
        try { const j = await res.json(); msg = j?.error || msg; } catch { /* binary */ }
        setErr(msg); return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Booking Order Sheet ${date}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setDownloading(false);
    }
  }

  const totalWeight = rows.reduce((s, r) => s + (parseFloat(r.weight) || 0), 0);

  const cellInput: React.CSSProperties = {
    width: "100%", border: "1px solid transparent", background: "transparent",
    padding: "5px 6px", fontSize: "0.8rem", borderRadius: 4, outline: "none",
  };

  return (
    <div style={{ padding: "2rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>Daily Order Book</h1>
          <p style={{ marginTop: "0.25rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Postal booking sheet — auto-filled from the day&apos;s booked orders. Edit any cell, then export in the courier-portal format.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Booking date</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ padding: "0.4rem 0.6rem", fontSize: "0.85rem", borderRadius: 8, border: "1px solid var(--border)" }} />
          </label>
          <button onClick={() => load(date)} disabled={loading} className="btn btn-secondary btn-sm">
            {loading ? "Loading…" : "↻ Load orders"}
          </button>
          <button onClick={download} disabled={downloading || rows.length === 0} className="btn btn-primary btn-sm">
            {downloading ? "Generating…" : "⬇ Download .xlsx"}
          </button>
        </div>
      </div>

      {err && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{err}</div>}

      {/* Summary */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <div className="card" style={{ padding: "0.6rem 1rem" }}>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>ROWS</div>
          <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{rows.length}</div>
        </div>
        <div className="card" style={{ padding: "0.6rem 1rem" }}>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>TOTAL WEIGHT (g)</div>
          <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{totalWeight.toLocaleString("en-IN")}</div>
        </div>
        {loadedFor && (
          <div className="card" style={{ padding: "0.6rem 1rem" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>LOADED FOR</div>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{new Date(loadedFor).toLocaleDateString("en-IN")}</div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
              <th style={{ padding: "8px 8px", textAlign: "left", fontWeight: 600, width: 36 }}>SL</th>
              {COLS.map(c => (
                <th key={c.key} style={{ padding: "8px 8px", textAlign: c.ta ?? "left", fontWeight: 600, minWidth: c.w }}>{c.label}</th>
              ))}
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={COLS.length + 2} style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                {loading ? "Loading…" : "No booked orders for this date. Pick another date, or click + Add Row."}
              </td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "4px 8px", color: "var(--text-muted)", fontSize: "0.78rem" }}>{i + 1}</td>
                {COLS.map(c => (
                  <td key={c.key} style={{ verticalAlign: "top" }}>
                    {c.key === "serviceMode" ? (
                      <select value={r.serviceMode} onChange={e => setCell(i, "serviceMode", e.target.value)} style={cellInput}>
                        {SERVICE_MODES.map(m => <option key={m}>{m}</option>)}
                      </select>
                    ) : c.key === "add1" ? (
                      <textarea value={r.add1} onChange={e => setCell(i, "add1", e.target.value)} rows={3}
                        style={{ ...cellInput, resize: "vertical", fontFamily: "inherit", lineHeight: 1.3 }} />
                    ) : (
                      <input value={r[c.key]} onChange={e => setCell(i, c.key, e.target.value)}
                        style={{ ...cellInput, fontFamily: c.mono ? "monospace" : "inherit", textAlign: c.ta ?? "left" }} />
                    )}
                  </td>
                ))}
                <td style={{ textAlign: "center" }}>
                  <button onClick={() => removeRow(i)} title="Remove"
                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.9rem" }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button onClick={addRow} className="btn btn-secondary btn-sm">+ Add Row</button>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Export keeps the full 29-column courier layout; blank template columns (Document No, Article details, etc.) are included empty.
        </span>
      </div>
    </div>
  );
}
