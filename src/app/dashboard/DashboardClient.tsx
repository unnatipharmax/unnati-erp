"use client";
import { useState, useEffect } from "react";

type ProductRow = {
  id: string;
  name: string;
  pack: string | null;
  batchNo: string | null;
  expDate: string;
  manufacturer: string | null;
  qty: number | null;
};

type ExpiryData = {
  expired: ProductRow[];
  within2: ProductRow[];
  within5: ProductRow[];
  within7: ProductRow[];
};

// ── Expiry table ──────────────────────────────────────────────────────────────
function ExpiryTable({ rows, color }: { rows: ProductRow[]; color: string }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: "0.75rem 1rem", color: "var(--text-muted)", fontSize: "0.82rem", fontStyle: "italic" }}>
        No products in this category.
      </div>
    );
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th style={{ padding: "0.45rem 0.75rem", textAlign: "left", fontWeight: 600, color: "var(--text-muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Product</th>
            <th style={{ padding: "0.45rem 0.75rem", textAlign: "left", fontWeight: 600, color: "var(--text-muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Manufacturer</th>
            <th style={{ padding: "0.45rem 0.75rem", textAlign: "left", fontWeight: 600, color: "var(--text-muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Pack</th>
            <th style={{ padding: "0.45rem 0.75rem", textAlign: "left", fontWeight: 600, color: "var(--text-muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Batch</th>
            <th style={{ padding: "0.45rem 0.75rem", textAlign: "right", fontWeight: 600, color: "var(--text-muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Qty</th>
            <th style={{ padding: "0.45rem 0.75rem", textAlign: "right", fontWeight: 600, color: "var(--text-muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Exp Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, idx) => (
            <tr
              key={p.id}
              style={{
                borderBottom: "1px solid var(--border)",
                background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
              }}
            >
              <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>{p.name}</td>
              <td style={{ padding: "0.5rem 0.75rem", color: "var(--text-secondary)" }}>{p.manufacturer ?? "—"}</td>
              <td style={{ padding: "0.5rem 0.75rem", color: "var(--text-secondary)" }}>{p.pack ?? "—"}</td>
              <td style={{ padding: "0.5rem 0.75rem" }}>
                {p.batchNo
                  ? <span style={{ fontFamily: "monospace", fontSize: "0.75rem", background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>{p.batchNo}</span>
                  : <span style={{ color: "var(--text-muted)" }}>—</span>}
              </td>
              <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {p.qty != null ? p.qty.toLocaleString("en-IN") : <span style={{ color: "var(--text-muted)" }}>—</span>}
              </td>
              <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                <span style={{
                  fontWeight: 700, fontFamily: "monospace", fontSize: "0.8rem",
                  color, padding: "2px 8px", borderRadius: 4,
                  background: `${color}1a`,
                }}>
                  {p.expDate}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────
function ExpirySection({
  label, sublabel, count, color, bg, border, children,
  defaultOpen = false,
}: {
  label: string;
  sublabel: string;
  count: number;
  color: string;
  bg: string;
  border: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      border: `1px solid ${border}`,
      borderRadius: 10,
      overflow: "hidden",
      marginBottom: "0.875rem",
    }}>
      {/* Section header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", textAlign: "left", background: bg,
          border: "none", padding: "0.75rem 1rem", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "0.75rem",
        }}
      >
        <span style={{
          minWidth: 28, height: 28, borderRadius: "50%",
          background: color, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: "0.8rem", flexShrink: 0,
        }}>
          {count}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.88rem", color }}>{label}</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 1 }}>{sublabel}</div>
        </div>
        <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{open ? "▲" : "▼"}</span>
      </button>

      {/* Table */}
      {open && (
        <div style={{ background: "var(--surface-1)", borderTop: `1px solid ${border}` }}>
          <ExpiryTable rows={children as any} color={color} />
        </div>
      )}
    </div>
  );
}

// ── Collapsible section (takes rows directly) ─────────────────────────────────
function ExpiryBucket({
  label, sublabel, rows, color, bg, border, defaultOpen,
}: {
  label: string; sublabel: string; rows: ProductRow[];
  color: string; bg: string; border: string; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div style={{ border: `1px solid ${border}`, borderRadius: 10, overflow: "hidden", marginBottom: "0.875rem" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", textAlign: "left", background: bg,
          border: "none", padding: "0.75rem 1rem", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "0.75rem",
        }}
      >
        <span style={{
          minWidth: 28, height: 28, borderRadius: "50%",
          background: color, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: "0.8rem", flexShrink: 0,
        }}>
          {rows.length}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.88rem", color }}>{label}</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 1 }}>{sublabel}</div>
        </div>
        <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ background: "var(--surface-1)", borderTop: `1px solid ${border}` }}>
          <ExpiryTable rows={rows} color={color} />
        </div>
      )}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function DashboardClient() {
  const [data, setData] = useState<ExpiryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/dashboard/expiry")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setErr("Failed to load expiry data"); setLoading(false); });
  }, []);

  const totalAlerts = data
    ? data.expired.length + data.within2.length + data.within5.length + data.within7.length
    : 0;

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>Dashboard</h1>
        <p style={{ marginTop: "0.25rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
          Welcome back · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* ── Expiry Alert Widget ── */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        {/* Widget header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.3rem" }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1rem" }}>Short Expiry Alerts</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Products expiring within 7 months</div>
            </div>
          </div>
          {!loading && data && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {[
                { label: "Expired", count: data.expired.length, color: "#ef4444" },
                { label: "≤2 mo", count: data.within2.length, color: "#f97316" },
                { label: "≤5 mo", count: data.within5.length, color: "#f59e0b" },
                { label: "≤7 mo", count: data.within7.length, color: "#eab308" },
              ].map(({ label, count, color }) => (
                <div key={label} style={{
                  padding: "4px 12px", borderRadius: 20,
                  background: `${color}18`, border: `1px solid ${color}40`,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ fontWeight: 700, color, fontSize: "0.85rem" }}>{count}</span>
                  <span style={{ fontSize: "0.73rem", color: "var(--text-secondary)" }}>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />)}
          </div>
        ) : err ? (
          <div className="alert alert-error">{err}</div>
        ) : !data || totalAlerts === 0 ? (
          <div style={{
            textAlign: "center", padding: "3rem 1rem",
            background: "rgba(16,185,129,0.06)", borderRadius: 10,
            border: "1px solid rgba(16,185,129,0.15)",
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✅</div>
            <div style={{ fontWeight: 600, color: "#10b981" }}>All products are well within expiry</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>No products expiring within 7 months.</div>
          </div>
        ) : (
          <>
            {/* Expired */}
            <ExpiryBucket
              label="Expired Products"
              sublabel="These products have already passed their expiry date — remove from stock immediately"
              rows={data.expired}
              color="#ef4444"
              bg="rgba(239,68,68,0.08)"
              border="rgba(239,68,68,0.25)"
              defaultOpen={data.expired.length > 0}
            />

            {/* ≤2 months */}
            <ExpiryBucket
              label="Expiring within 2 Months"
              sublabel="Critical — clear or return these to the supplier urgently"
              rows={data.within2}
              color="#f97316"
              bg="rgba(249,115,22,0.08)"
              border="rgba(249,115,22,0.22)"
              defaultOpen={data.within2.length > 0}
            />

            {/* ≤5 months */}
            <ExpiryBucket
              label="Expiring within 5 Months"
              sublabel="Plan sales or returns — these need attention soon"
              rows={data.within5}
              color="#f59e0b"
              bg="rgba(245,158,11,0.08)"
              border="rgba(245,158,11,0.22)"
              defaultOpen={false}
            />

            {/* ≤7 months */}
            <ExpiryBucket
              label="Expiring within 7 Months"
              sublabel="Monitor closely — move stock proactively"
              rows={data.within7}
              color="#eab308"
              bg="rgba(234,179,8,0.08)"
              border="rgba(234,179,8,0.22)"
              defaultOpen={false}
            />
          </>
        )}
      </div>
    </div>
  );
}
