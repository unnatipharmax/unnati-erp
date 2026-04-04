"use client";
import { useState, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
type ProductRow = { id: string; name: string; pack: string | null; batchNo: string | null; expDate: string; manufacturer: string | null; qty: number | null };
type ExpiryData = { expired: ProductRow[]; within2: ProductRow[]; within5: ProductRow[]; within7: ProductRow[] };

type ReportData = {
  kpis: { totalOrders: number; dispatchedCount: number; totalRevenue: number; totalProducts: number; totalParties: number; pendingBillCount: number; totalPendingAmount: number };
  topProducts:       { productId: string; productName: string; manufacturer: string | null; totalQty: number; totalRevenue: number }[];
  bestSellers:       { productId: string; productName: string; manufacturer: string | null; totalRevenue: number; totalQty: number }[];
  countrySales:      { country: string; orderCount: number; totalRevenue: number }[];
  monthlyRevenue:    { month: string; orderCount: number; totalRevenue: number }[];
  pendingPayments:   { partyId: string; partyName: string; billCount: number; outstanding: number }[];
  returnedShipments: { id: string; invoiceNo: string | null; partyName: string; date: string; amount: number }[];
  topPurchaseParties:{ partyId: string; partyName: string; billCount: number; totalPurchase: number }[];
  topWorkers:        { userId: string; userName: string; role: string; orderCount: number }[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n: number) { return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtUsd(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtShort(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}
function fmtMonth(s: string) {
  const [y, m] = s.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="card" style={{ padding: "1rem 1.25rem" }}>
      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: "1.35rem", fontWeight: 800, color, fontFamily: "monospace", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, icon, children, accent = "#6366f1" }: { title: string; icon: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--surface-2)" }}>
        <span style={{ fontSize: "1rem" }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: "0.88rem", color: accent }}>{title}</span>
      </div>
      <div style={{ padding: "0.75rem 1rem" }}>{children}</div>
    </div>
  );
}

// ── Rank list row ──────────────────────────────────────────────────────────────
function RankRow({ rank, label, sub, value, valueColor = "#93c5fd", bar, maxBar }: {
  rank: number; label: string; sub?: string; value: string; valueColor?: string; bar: number; maxBar: number;
}) {
  const pct = maxBar > 0 ? Math.round((bar / maxBar) * 100) : 0;
  return (
    <div style={{ marginBottom: "0.6rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 0 }}>
          <span style={{
            width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
            background: rank <= 3 ? ["#ffd700","#c0c0c0","#cd7f32"][rank-1] : "var(--surface-2)",
            color: rank <= 3 ? "#000" : "var(--text-muted)",
            fontSize: "0.65rem", fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{rank}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
            {sub && <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{sub}</div>}
          </div>
        </div>
        <span style={{ fontFamily: "monospace", fontSize: "0.8rem", fontWeight: 700, color: valueColor, flexShrink: 0, marginLeft: 8 }}>{value}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "var(--surface-2)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: valueColor, borderRadius: 2, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

// ── Monthly bar chart ──────────────────────────────────────────────────────────
function MonthlyChart({ data }: { data: ReportData["monthlyRevenue"] }) {
  if (data.length === 0) return <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", padding: "1rem 0" }}>No data yet.</div>;
  const maxRev = Math.max(...data.map(d => d.totalRevenue), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "0.375rem", height: 100, paddingBottom: 20, position: "relative" }}>
      {data.map(d => {
        const h = Math.max(4, Math.round((d.totalRevenue / maxRev) * 80));
        return (
          <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, position: "relative" }}>
            <div title={`${fmtMonth(d.month)}: ${fmtShort(d.totalRevenue)} (${d.orderCount} orders)`} style={{
              width: "100%", height: h, background: "linear-gradient(to top, #6366f1, #818cf8)",
              borderRadius: "3px 3px 0 0", cursor: "pointer", transition: "opacity 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            />
            <span style={{ fontSize: "0.58rem", color: "var(--text-muted)", position: "absolute", bottom: 0, whiteSpace: "nowrap" }}>
              {fmtMonth(d.month)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Expiry sub-components ──────────────────────────────────────────────────────
function ExpiryTable({ rows, color }: { rows: ProductRow[]; color: string }) {
  if (rows.length === 0) return <div style={{ padding: "0.75rem 1rem", color: "var(--text-muted)", fontSize: "0.82rem", fontStyle: "italic" }}>No products.</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Product", "Manufacturer", "Batch", "Qty", "Exp"].map(h => (
              <th key={h} style={{ padding: "0.4rem 0.75rem", textAlign: h === "Qty" || h === "Exp" ? "right" : "left", fontWeight: 600, color: "var(--text-muted)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, idx) => (
            <tr key={p.id} style={{ borderBottom: "1px solid var(--border)", background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
              <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>{p.name}</td>
              <td style={{ padding: "0.5rem 0.75rem", color: "var(--text-secondary)" }}>{p.manufacturer ?? "—"}</td>
              <td style={{ padding: "0.5rem 0.75rem", fontFamily: "monospace", fontSize: "0.75rem" }}>{p.batchNo ?? "—"}</td>
              <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>{p.qty ?? "—"}</td>
              <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: "0.78rem", color, padding: "1px 6px", borderRadius: 4, background: `${color}1a` }}>{p.expDate}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpiryBucket({ label, sublabel, rows, color, bg, border, defaultOpen }: { label: string; sublabel: string; rows: ProductRow[]; color: string; bg: string; border: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div style={{ border: `1px solid ${border}`, borderRadius: 10, overflow: "hidden", marginBottom: "0.75rem" }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", textAlign: "left", background: bg, border: "none", padding: "0.65rem 1rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span style={{ minWidth: 24, height: 24, borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.78rem", flexShrink: 0 }}>{rows.length}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.85rem", color }}>{label}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{sublabel}</div>
        </div>
        <span style={{ color: "var(--text-muted)" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div style={{ background: "var(--surface-1)", borderTop: `1px solid ${border}` }}><ExpiryTable rows={rows} color={color} /></div>}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardClient() {
  const [expiry,   setExpiry]   = useState<ExpiryData | null>(null);
  const [reports,  setReports]  = useState<ReportData | null>(null);
  const [loadingE, setLoadingE] = useState(true);
  const [loadingR, setLoadingR] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/expiry").then(r => r.json()).then(d => { setExpiry(d); setLoadingE(false); }).catch(() => setLoadingE(false));
    fetch("/api/dashboard/reports").then(r => r.json()).then(d => { setReports(d); setLoadingR(false); }).catch(() => setLoadingR(false));
  }, []);

  const kpis = reports?.kpis;

  return (
    <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Page header ── */}
      <div>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>Dashboard</h1>
        <p style={{ marginTop: "0.25rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem" }}>
        {loadingR ? (
          [1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 86, borderRadius: 12 }} />)
        ) : kpis ? (
          <>
            <KpiCard label="Total Orders"      value={kpis.totalOrders.toString()}       color="#818cf8" />
            <KpiCard label="Dispatched"        value={kpis.dispatchedCount.toString()}   color="#6ee7b7" sub="completed orders" />
            <KpiCard label="Total Revenue"     value={fmtShort(kpis.totalRevenue)}       color="#fcd34d" sub="dispatched orders" />
            <KpiCard label="Active Products"   value={kpis.totalProducts.toString()}     color="#93c5fd" />
            <KpiCard label="Active Parties"    value={kpis.totalParties.toString()}      color="#fb923c" />
            <KpiCard label="Pending Bills"     value={fmt(kpis.totalPendingAmount)}      color="#f87171" sub={`${kpis.pendingBillCount} parties`} />
          </>
        ) : null}
      </div>

      {/* ── Monthly Revenue Chart ── */}
      <Section title="Monthly Revenue (Last 12 Months)" icon="📈">
        {loadingR ? <div className="skeleton" style={{ height: 120, borderRadius: 8 }} /> :
          reports ? <MonthlyChart data={reports.monthlyRevenue} /> : null}
      </Section>

      {/* ── 3-column grid: Top Products | Best Sellers | Country Sales ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>

        {/* Top Selling Products (by qty) */}
        <Section title="Top Selling Products" icon="🏆" accent="#fcd34d">
          {loadingR ? [1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 36, borderRadius: 6, marginBottom: 8 }} />) :
            reports?.topProducts.length === 0 ? <div style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>No data yet.</div> :
            reports?.topProducts.map((p, i) => (
              <RankRow key={p.productId} rank={i+1} label={p.productName}
                sub={p.manufacturer ?? undefined}
                value={`${p.totalQty.toLocaleString()} units`}
                valueColor="#fcd34d"
                bar={p.totalQty} maxBar={reports.topProducts[0]?.totalQty ?? 1}
              />
            ))}
        </Section>

        {/* Best Sellers by Revenue */}
        <Section title="Best Sellers by Revenue" icon="💰" accent="#6ee7b7">
          {loadingR ? [1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 36, borderRadius: 6, marginBottom: 8 }} />) :
            reports?.bestSellers.length === 0 ? <div style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>No data yet.</div> :
            reports?.bestSellers.map((p, i) => (
              <RankRow key={p.productId} rank={i+1} label={p.productName}
                sub={p.manufacturer ?? undefined}
                value={fmtUsd(p.totalRevenue)}
                valueColor="#6ee7b7"
                bar={p.totalRevenue} maxBar={reports.bestSellers[0]?.totalRevenue ?? 1}
              />
            ))}
        </Section>

        {/* Country-wise Sales */}
        <Section title="Country-wise Sales" icon="🌍" accent="#93c5fd">
          {loadingR ? [1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 36, borderRadius: 6, marginBottom: 8 }} />) :
            reports?.countrySales.length === 0 ? <div style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>No data yet.</div> :
            reports?.countrySales.map((c, i) => (
              <RankRow key={c.country} rank={i+1} label={c.country}
                sub={`${c.orderCount} order${c.orderCount !== 1 ? "s" : ""}`}
                value={fmtShort(c.totalRevenue)}
                valueColor="#93c5fd"
                bar={c.orderCount} maxBar={reports.countrySales[0]?.orderCount ?? 1}
              />
            ))}
        </Section>
      </div>

      {/* ── 3-column grid: Pending Payments | Top Purchase | Top Workers ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>

        {/* Pending Payments */}
        <Section title="Pending Payments (Party-wise)" icon="⏳" accent="#f87171">
          {loadingR ? [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 36, borderRadius: 6, marginBottom: 8 }} />) :
            reports?.pendingPayments.length === 0
              ? <div style={{ color: "#6ee7b7", fontSize: "0.82rem" }}>✅ No pending payments.</div>
              : reports?.pendingPayments.map((p, i) => (
                <RankRow key={p.partyId} rank={i+1} label={p.partyName}
                  sub={`${p.billCount} bill${p.billCount !== 1 ? "s" : ""}`}
                  value={fmt(p.outstanding)}
                  valueColor="#f87171"
                  bar={p.outstanding} maxBar={reports.pendingPayments[0]?.outstanding ?? 1}
                />
              ))}
        </Section>

        {/* Top Purchase Parties */}
        <Section title="Top Purchase Parties" icon="🏭" accent="#fb923c">
          {loadingR ? [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 36, borderRadius: 6, marginBottom: 8 }} />) :
            reports?.topPurchaseParties.length === 0
              ? <div style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>No data yet.</div>
              : reports?.topPurchaseParties.map((p, i) => (
                <RankRow key={p.partyId} rank={i+1} label={p.partyName}
                  sub={`${p.billCount} bill${p.billCount !== 1 ? "s" : ""}`}
                  value={fmt(p.totalPurchase)}
                  valueColor="#fb923c"
                  bar={p.totalPurchase} maxBar={reports.topPurchaseParties[0]?.totalPurchase ?? 1}
                />
              ))}
        </Section>

        {/* Top Team Workers */}
        <Section title="Top Team (Sales Generated)" icon="👥" accent="#a78bfa">
          {loadingR ? [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 36, borderRadius: 6, marginBottom: 8 }} />) :
            reports?.topWorkers.length === 0
              ? <div style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>No sales orders with assigned users yet.</div>
              : reports?.topWorkers.map((w, i) => (
                <RankRow key={w.userId} rank={i+1} label={w.userName}
                  sub={w.role}
                  value={`${w.orderCount} order${w.orderCount !== 1 ? "s" : ""}`}
                  valueColor="#a78bfa"
                  bar={w.orderCount} maxBar={reports.topWorkers[0]?.orderCount ?? 1}
                />
              ))}
        </Section>
      </div>

      {/* ── Returned Shipments (Credit Notes) ── */}
      <Section title="Returned Shipments / Credit Notes" icon="↩️" accent="#fb923c">
        {loadingR ? <div className="skeleton" style={{ height: 80, borderRadius: 8 }} /> :
          !reports?.returnedShipments.length
            ? <div style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>No credit notes / returns found.</div>
            : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["#", "Party", "Credit Note No.", "Date", "Amount"].map(h => (
                        <th key={h} style={{ padding: "0.4rem 0.75rem", textAlign: h === "Amount" ? "right" : "left", fontWeight: 600, color: "var(--text-muted)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reports.returnedShipments.map((r, idx) => (
                      <tr key={r.id} style={{ borderBottom: "1px solid var(--border)", background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                        <td style={{ padding: "0.45rem 0.75rem", color: "var(--text-muted)", fontFamily: "monospace", fontSize: "0.75rem" }}>{idx+1}</td>
                        <td style={{ padding: "0.45rem 0.75rem", fontWeight: 600 }}>{r.partyName}</td>
                        <td style={{ padding: "0.45rem 0.75rem", fontFamily: "monospace", color: "#818cf8" }}>{r.invoiceNo ?? "—"}</td>
                        <td style={{ padding: "0.45rem 0.75rem", color: "var(--text-secondary)" }}>{r.date}</td>
                        <td style={{ padding: "0.45rem 0.75rem", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#fb923c" }}>{fmt(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </Section>

      {/* ── Expiry Alerts ── */}
      <div className="card" style={{ padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.2rem" }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Short Expiry Alerts</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Products expiring within 7 months</div>
            </div>
          </div>
          {!loadingE && expiry && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {[
                { label: "Expired", count: expiry.expired.length, color: "#ef4444" },
                { label: "≤2 mo",  count: expiry.within2.length, color: "#f97316" },
                { label: "≤5 mo",  count: expiry.within5.length, color: "#f59e0b" },
                { label: "≤7 mo",  count: expiry.within7.length, color: "#eab308" },
              ].map(({ label, count, color }) => (
                <div key={label} style={{ padding: "3px 10px", borderRadius: 20, background: `${color}18`, border: `1px solid ${color}40`, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontWeight: 700, color, fontSize: "0.82rem" }}>{count}</span>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {loadingE ? (
          [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8, marginBottom: 8 }} />)
        ) : !expiry || (expiry.expired.length + expiry.within2.length + expiry.within5.length + expiry.within7.length) === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", background: "rgba(16,185,129,0.06)", borderRadius: 10, border: "1px solid rgba(16,185,129,0.15)" }}>
            <div style={{ fontSize: "1.8rem", marginBottom: "0.4rem" }}>✅</div>
            <div style={{ fontWeight: 600, color: "#10b981" }}>All products are within expiry</div>
          </div>
        ) : (
          <>
            <ExpiryBucket label="Expired"              sublabel="Remove from stock immediately"            rows={expiry.expired} color="#ef4444" bg="rgba(239,68,68,0.08)"   border="rgba(239,68,68,0.25)"  defaultOpen={expiry.expired.length > 0} />
            <ExpiryBucket label="Expiring ≤ 2 Months"  sublabel="Critical — return or clear urgently"     rows={expiry.within2} color="#f97316" bg="rgba(249,115,22,0.08)"  border="rgba(249,115,22,0.22)" defaultOpen={expiry.within2.length > 0} />
            <ExpiryBucket label="Expiring ≤ 5 Months"  sublabel="Plan sales or returns soon"              rows={expiry.within5} color="#f59e0b" bg="rgba(245,158,11,0.08)"  border="rgba(245,158,11,0.22)" />
            <ExpiryBucket label="Expiring ≤ 7 Months"  sublabel="Monitor closely — move stock proactively" rows={expiry.within7} color="#eab308" bg="rgba(234,179,8,0.08)"   border="rgba(234,179,8,0.22)"  />
          </>
        )}
      </div>

    </div>
  );
}
