"use client";
import { useState, useEffect, useRef } from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtNum(n: number, dec = 2) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ── Product Ledger Types ──────────────────────────────────────────────────────
type LedgerEntry = {
  id: string; date: string; billNo: string; particulars: string;
  type: "purchase" | "purchase_return" | "sale";
  receive: number | null; issue: number | null; balance: number;
  rate: number; amount: number;
};
type LedgerData = {
  product: { id: string; name: string; composition: string | null; manufacturer: string | null; pack: string | null; mrp: number | null; hsn: string | null };
  from: string; to: string;
  entries: LedgerEntry[];
  summary: {
    openingQty: number; openingVal: number;
    totalReceiveQty: number; totalReceiveVal: number;
    totalReturnQty: number; totalReturnVal: number;
    totalSaleQty: number; totalSaleVal: number;
    totalIssueQty: number; totalIssueVal: number;
    closingQty: number; closingVal: number;
  };
};

// ── Financial year helper ─────────────────────────────────────────────────────
function currentFY() {
  const now = new Date();
  const y   = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: `${y}-04-01`, to: `${y + 1}-03-31` };
}

// ── Product Ledger Overlay ────────────────────────────────────────────────────
function ProductLedgerOverlay({
  productId, productName, onClose,
}: { productId: string; productName: string; onClose: () => void }) {
  const fy = currentFY();
  const [from,    setFrom]    = useState(fy.from);
  const [to,      setTo]      = useState(fy.to);
  const [data,    setData]    = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");

  async function load(f = from, t = to) {
    setLoading(true); setErr("");
    const res  = await fetch(`/api/products/${productId}/ledger?from=${f}&to=${t}`);
    const json = await res.json();
    if (!res.ok) { setErr(json?.error || "Failed to load"); setLoading(false); return; }
    setData(json); setLoading(false);
  }

  useEffect(() => { load(); }, [productId]);

  const COL = "130px 100px 1fr 80px 80px 80px 80px 90px";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "stretch",
    }}>
      <div style={{ flex: 1 }} onClick={onClose} />
      <div style={{
        width: "min(1180px, 97vw)", background: "var(--surface-1)",
        borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* ── Header ── */}
        <div style={{
          padding: "1rem 1.5rem 0", borderBottom: "1px solid var(--border)",
          position: "sticky", top: 0, background: "var(--surface-1)", zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>{productName}</h2>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Stock Ledger
                </span>
              </div>
              {data && (
                <div style={{ fontSize: "0.77rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                  {data.product.composition && <span>{data.product.composition} · </span>}
                  {data.product.manufacturer && <span>{data.product.manufacturer} · </span>}
                  {data.product.pack && <span>Pack: {data.product.pack}</span>}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.5rem", cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>

          {/* Date filter */}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", paddingBottom: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>Period:</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              style={{ padding: "0.3rem 0.5rem", fontSize: "0.82rem", borderRadius: 6 }} />
            <span style={{ color: "var(--text-muted)" }}>to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              style={{ padding: "0.3rem 0.5rem", fontSize: "0.82rem", borderRadius: 6 }} />
            <button onClick={() => load(from, to)} className="btn btn-secondary btn-sm" style={{ fontSize: "0.78rem" }}>
              Apply
            </button>
            <button onClick={() => { const f = currentFY(); setFrom(f.from); setTo(f.to); load(f.from, f.to); }}
              className="btn btn-secondary btn-sm" style={{ fontSize: "0.78rem" }}>
              Current FY
            </button>
          </div>
        </div>

        {/* ── Summary bar (Marg-style) ── */}
        {data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
            {[
              { label: "Opening Balance", qty: data.summary.openingQty, val: data.summary.openingVal, color: "var(--text-secondary)" },
              { label: "Purchase", qty: data.summary.totalReceiveQty, val: data.summary.totalReceiveVal, color: "#93c5fd" },
              { label: "Purchase Return", qty: data.summary.totalReturnQty, val: data.summary.totalReturnVal, color: "#fb923c" },
              { label: "Sales", qty: data.summary.totalSaleQty, val: data.summary.totalSaleVal, color: "#fca5a5" },
              { label: "Closing Balance", qty: data.summary.closingQty, val: data.summary.closingVal, color: "#fcd34d" },
            ].map(({ label, qty, val, color }) => (
              <div key={label} style={{ padding: "0.7rem 1.25rem", borderRight: "1px solid var(--border)" }}>
                <div style={{ fontSize: "0.67rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>{label}</div>
                <div style={{ display: "flex", gap: "1rem", alignItems: "baseline" }}>
                  <span style={{ fontWeight: 700, fontSize: "1.1rem", color, fontFamily: "monospace" }}>
                    {qty.toLocaleString("en-IN")}
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                    ₹{fmtNum(Math.abs(val))}
                  </span>
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>units · value</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Ledger table ── */}
        <div style={{ flex: 1 }}>
          {loading ? (
            <div style={{ padding: "2rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 36, borderRadius: 6 }} />)}
            </div>
          ) : err ? (
            <div className="alert alert-error" style={{ margin: "1.5rem" }}>{err}</div>
          ) : !data || data.entries.length === 0 ? (
            <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem", opacity: 0.3 }}>📦</div>
              <div style={{ fontWeight: 600 }}>No transactions in this period</div>
            </div>
          ) : (
            <>
              {/* Column header */}
              <div style={{
                display: "grid", gridTemplateColumns: COL,
                padding: "0.45rem 1.25rem",
                background: "var(--surface-2)",
                borderBottom: "2px solid var(--border)",
                fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)",
                textTransform: "uppercase", letterSpacing: "0.05em",
                position: "sticky", top: "calc(var(--hdr,0px))",
              }}>
                <span>Bill No</span>
                <span>Date</span>
                <span>Particulars</span>
                <span style={{ textAlign: "right" }}>Rate</span>
                <span style={{ textAlign: "right" }}>Amount</span>
                <span style={{ textAlign: "right", color: "#93c5fd" }}>Receive</span>
                <span style={{ textAlign: "right", color: "#fca5a5" }}>Issue</span>
                <span style={{ textAlign: "right", color: "#fcd34d" }}>Balance</span>
              </div>

              {/* Opening row */}
              {data.summary.openingQty !== 0 && (
                <div style={{
                  display: "grid", gridTemplateColumns: COL,
                  padding: "0.45rem 1.25rem",
                  background: "rgba(0,0,0,0.15)", borderBottom: "1px solid var(--border)",
                  fontSize: "0.8rem",
                }}>
                  <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>—</span>
                  <span style={{ color: "var(--text-muted)" }}>—</span>
                  <span style={{ fontStyle: "italic", color: "var(--text-muted)" }}>Opening Balance</span>
                  <span></span><span></span><span></span><span></span>
                  <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#fcd34d" }}>
                    {data.summary.openingQty.toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {/* Ledger rows */}
              {data.entries.map((entry, idx) => (
                <div
                  key={entry.id}
                  style={{
                    display: "grid", gridTemplateColumns: COL,
                    padding: "0.45rem 1.25rem",
                    borderBottom: "1px solid var(--border)",
                    background: entry.type === "purchase"
                      ? idx % 2 === 0 ? "rgba(147,197,253,0.03)" : "rgba(147,197,253,0.06)"
                      : entry.type === "purchase_return"
                        ? idx % 2 === 0 ? "rgba(251,146,60,0.03)" : "rgba(251,146,60,0.06)"
                        : idx % 2 === 0 ? "rgba(252,165,165,0.03)" : "rgba(252,165,165,0.06)",
                    alignItems: "center",
                  }}
                >
                  {/* Bill No */}
                  <span style={{ fontFamily: "monospace", fontSize: "0.76rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    {entry.billNo}
                  </span>

                  {/* Date */}
                  <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {fmtDate(entry.date)}
                  </span>

                  {/* Particulars */}
                  <span style={{
                    fontSize: "0.8rem",
                    color: entry.type === "purchase" ? "#93c5fd" : entry.type === "purchase_return" ? "#fb923c" : "#fca5a5",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {entry.particulars}
                  </span>

                  {/* Rate */}
                  <span style={{ textAlign: "right", fontFamily: "monospace", fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                    ₹{fmtNum(entry.rate)}
                  </span>

                  {/* Amount */}
                  <span style={{ textAlign: "right", fontFamily: "monospace", fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                    ₹{fmtNum(entry.amount)}
                  </span>

                  {/* Receive */}
                  <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: entry.receive ? 700 : 400, color: entry.receive ? "#93c5fd" : "var(--text-muted)" }}>
                    {entry.receive != null ? entry.receive.toLocaleString("en-IN") : "—"}
                  </span>

                  {/* Issue */}
                  <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: entry.issue ? 700 : 400, color: entry.issue ? "#fca5a5" : "var(--text-muted)" }}>
                    {entry.issue != null ? entry.issue.toLocaleString("en-IN") : "—"}
                  </span>

                  {/* Balance */}
                  <span style={{
                    textAlign: "right", fontFamily: "monospace", fontWeight: 700,
                    color: entry.balance > 0 ? "#fcd34d" : entry.balance < 0 ? "#f87171" : "var(--text-muted)",
                  }}>
                    {entry.balance.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}

              {/* Closing balance footer */}
              <div style={{
                display: "grid", gridTemplateColumns: COL,
                padding: "0.65rem 1.25rem",
                background: "var(--surface-2)",
                borderTop: "2px solid var(--border)",
                position: "sticky", bottom: 0,
              }}>
                <span></span><span></span>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)" }}>Closing Balance</span>
                <span></span>
                <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                  ₹{fmtNum(Math.abs(data.summary.totalReceiveVal + data.summary.openingVal - data.summary.totalIssueVal))}
                </span>
                <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#93c5fd" }}>
                  {data.summary.totalReceiveQty.toLocaleString("en-IN")}
                </span>
                <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#fb923c" }}>
                  {data.summary.totalIssueQty.toLocaleString("en-IN")}
                </span>
                <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: "1rem", color: "#fcd34d" }}>
                  {data.summary.closingQty.toLocaleString("en-IN")}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type Group = { id: string; name: string };

type Product = {
  id: string; name: string; manufacturer: string | null;
  hsn: string | null; pack: string | null; mrp: number | null;
  gstPercent: number | null; composition: string | null;
  batchNo: string | null; mfgDate: string | null; expDate: string | null;
  latestRate: number | null; inrUnit: number | null; createdAt: string;
  minMargin: number | null; maxMargin: number | null;
  qty: number | null; unitType: string | null; unitWeightKg: number | null;
  groupId: string | null; groupName: string | null;
};

// Default unit weights per type (kg per single unit)
const DEFAULT_UNIT_WEIGHTS: Record<string, number> = {
  Strip: 0.00823,
  Tube:  0.0395,
};

const UNIT_TYPES = ["Strip","Tube","Bottle","Sachet","Vial","Ampoule","Box","Inhaler","Cream","Ointment","Syrup","Drops","Spray","Injection","Patch","Tablet","Capsule"];

const EMPTY = {
  name: "", manufacturer: "", hsn: "", pack: "",
  mrp: "", gstPercent: "", composition: "",
  batchNo: "", mfgDate: "", expDate: "",
  minMargin: "", maxMargin: "", qty: "", unitType: "", unitWeightKg: "", groupId: "",
};

// ── Group dropdown with inline "Add New" ──────────────────────────────────────
function GroupSelect({
  groups, value, onChange, onGroupCreated,
}: {
  groups: Group[];
  value: string;
  onChange: (id: string) => void;
  onGroupCreated: (g: Group) => void;
}) {
  const [adding, setAdding]   = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");
  const inputRef              = useRef<HTMLInputElement>(null);

  async function createGroup() {
    if (!newName.trim()) return;
    setSaving(true); setErr("");
    const res  = await fetch("/api/product-groups", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const json = await res.json();
    if (!res.ok) { setErr(json?.error || "Failed"); setSaving(false); return; }
    onGroupCreated(json.group);
    onChange(json.group.id);
    setNewName(""); setAdding(false); setSaving(false);
  }

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ flex: 1, fontSize: "0.875rem", padding: "0.5rem 0.6rem" }}
        >
          <option value="">— No Group —</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => { setAdding(a => !a); setErr(""); setNewName(""); }}
          className="btn btn-secondary btn-sm"
          style={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
        >
          {adding ? "✕ Cancel" : "+ New"}
        </button>
      </div>

      {adding && (
        <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            ref={inputRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") createGroup(); }}
            placeholder="e.g. Anti Cancer"
            style={{ flex: 1, fontSize: "0.8rem", padding: "0.4rem 0.6rem" }}
          />
          <button
            type="button"
            onClick={createGroup}
            disabled={saving || !newName.trim()}
            className="btn btn-primary btn-sm"
            style={{ fontSize: "0.78rem" }}
          >
            {saving ? "…" : "Add"}
          </button>
        </div>
      )}
      {err && <div style={{ fontSize: "0.75rem", color: "#f87171", marginTop: "0.25rem" }}>{err}</div>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ProductMasterClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [groups,   setGroups]   = useState<Group[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [modal,    setModal]    = useState<"add" | "edit" | null>(null);
  const [editing,  setEditing]  = useState<Product | null>(null);
  const [form,     setForm]     = useState({ ...EMPTY });
  const [saving,       setSaving]       = useState(false);
  const [err,          setErr]          = useState("");
  const [ledgerProduct, setLedgerProduct] = useState<{ id: string; name: string } | null>(null);

  async function load() {
    setLoading(true);
    const [prodRes, grpRes] = await Promise.all([
      fetch("/api/products"),
      fetch("/api/product-groups"),
    ]);
    const prodData = await prodRes.json();
    const grpData  = await grpRes.json();
    setProducts(prodData.products ?? []);
    setGroups(grpData.groups ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function openAdd() {
    setForm({ ...EMPTY }); setEditing(null); setErr(""); setModal("add");
  }
  function openEdit(p: Product) {
    setForm({
      name: p.name, manufacturer: p.manufacturer ?? "",
      hsn: p.hsn ?? "", pack: p.pack ?? "",
      mrp: p.mrp?.toString() ?? "", gstPercent: p.gstPercent?.toString() ?? "",
      composition: p.composition ?? "", batchNo: p.batchNo ?? "",
      mfgDate: p.mfgDate ?? "", expDate: p.expDate ?? "",
      minMargin: p.minMargin?.toString() ?? "",
      maxMargin: p.maxMargin?.toString() ?? "",
      qty: p.qty?.toString() ?? "",
      unitType: p.unitType ?? "",
      unitWeightKg: p.unitWeightKg?.toString() ?? "",
      groupId: p.groupId ?? "",
    });
    setEditing(p); setErr(""); setModal("edit");
  }

  async function save() {
    if (!form.name.trim()) { setErr("Product name is required"); return; }
    setSaving(true); setErr("");
    const url    = editing ? `/api/products/${editing.id}` : "/api/products";
    const method = editing ? "PATCH" : "POST";
    const res  = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data?.error || "Save failed"); setSaving(false); return; }
    setModal(null); setSaving(false);
    load();
  }

  async function del(id: string) {
    if (!confirm("Delete this product?")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = products.filter(p =>
    [p.name, p.manufacturer, p.hsn, p.composition, p.batchNo, p.groupName]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1>Product Master</h1>
          <p style={{ marginTop: "0.25rem" }}>{products.length} products · {groups.length} groups</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, composition, group..."
            style={{ padding: "0.5rem 0.75rem", minWidth: 240, fontSize: "0.875rem" }}
          />
          <button onClick={openAdd} className="btn btn-primary">+ Add Product</button>
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 10 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
          {search ? "No products match your search." : "No products yet. Add your first product."}
        </div>
      ) : (
        <div className="table-wrapper" style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 1400 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Group</th>
                <th>Composition</th>
                <th>Manufacturer</th>
                <th>HSN</th>
                <th>Pack</th>
                <th>Qty / Type</th>
                <th>Batch No</th>
                <th>Mfg / Exp</th>
                <th style={{ textAlign: "right" }}>MRP</th>
                <th style={{ textAlign: "right" }}>GST %</th>
                <th style={{ textAlign: "right" }}>Min %</th>
                <th style={{ textAlign: "right" }}>Max %</th>
                <th style={{ textAlign: "right" }}>Purchase Rate</th>
                <th style={{ textAlign: "right" }}>INR Unit (+15%)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>
                    {p.groupName
                      ? <span className="badge badge-blue" style={{ fontSize: "0.7rem" }}>{p.groupName}</span>
                      : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{p.composition ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{p.manufacturer ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{p.hsn ?? "—"}</td>
                  <td>{p.pack ?? "—"}</td>
                  <td>
                    {(p.qty != null || p.unitType) ? (
                      <span className="badge badge-blue" style={{ fontSize: "0.72rem" }}>
                        {p.qty != null ? `${p.qty} ` : ""}{p.unitType ?? ""}
                      </span>
                    ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {p.batchNo
                      ? <span className="badge badge-blue" style={{ fontSize: "0.7rem" }}>{p.batchNo}</span>
                      : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                    {p.mfgDate ?? "—"} / {p.expDate
                      ? <span className="badge badge-amber" style={{ fontSize: "0.7rem" }}>{p.expDate}</span>
                      : "—"}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {p.mrp != null ? `₹${p.mrp}` : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>{p.gstPercent != null ? `${p.gstPercent}%` : "—"}</td>
                  <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>
                    {p.minMargin != null ? `${p.minMargin}%` : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>
                    {p.maxMargin != null ? `${p.maxMargin}%` : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>
                    {p.latestRate != null ? `₹${p.latestRate.toFixed(2)}` : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {p.inrUnit != null
                      ? <span className="badge badge-green" style={{ fontSize: "0.75rem" }}>₹{p.inrUnit.toFixed(2)}</span>
                      : <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No purchase</span>}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.375rem" }}>
                      <button onClick={() => setLedgerProduct({ id: p.id, name: p.name })} className="btn btn-secondary btn-sm" style={{ fontSize: "0.72rem" }}>📊 Ledger</button>
                      <button onClick={() => openEdit(p)} className="btn btn-secondary btn-sm">Edit</button>
                      <button onClick={() => del(p.id)} className="btn btn-sm" style={{ color: "#f87171", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth: 680, width: "100%" }}>
            <div className="modal-header">
              <h3>{modal === "add" ? "Add Product" : "Edit Product"}</h3>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.25rem", cursor: "pointer" }}>✕</button>
            </div>
            <div className="modal-body">
              {err && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{err}</div>}

              {/* Row 1: Name + Composition */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Product Name *</label>
                  <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. MORNING PILLS" />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Composition</label>
                  <input value={form.composition} onChange={e => set("composition", e.target.value)} placeholder="e.g. LEVONORGESTREL TAB 1.5" />
                </div>
              </div>

              {/* Row 2: Manufacturer + HSN */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Manufacturer</label>
                  <input value={form.manufacturer} onChange={e => set("manufacturer", e.target.value)} placeholder="e.g. HEALING PHARMA" />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>HSN Code</label>
                  <input value={form.hsn} onChange={e => set("hsn", e.target.value)} placeholder="e.g. 30059060" />
                </div>
              </div>

              {/* Row 3: Group */}
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Group / Category</label>
                <GroupSelect
                  groups={groups}
                  value={form.groupId}
                  onChange={id => set("groupId", id)}
                  onGroupCreated={g => setGroups(prev => [...prev, g].sort((a, b) => a.name.localeCompare(b.name)))}
                />
              </div>

              {/* Row 4: Batch + Mfg + Exp */}
              <div style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.12)", borderRadius: 10, padding: "0.75rem", marginBottom: "0.75rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.5rem", fontWeight: 600 }}>Batch & Dates</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Batch No</label>
                    <input value={form.batchNo} onChange={e => set("batchNo", e.target.value)} placeholder="e.g. DH250092B" />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Mfg Date</label>
                    <input value={form.mfgDate} onChange={e => set("mfgDate", e.target.value)} placeholder="e.g. Jul-25" />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Exp Date</label>
                    <input value={form.expDate} onChange={e => set("expDate", e.target.value)} placeholder="e.g. Jun-27" />
                  </div>
                </div>
              </div>

              {/* Row 5: Qty + Unit Type + Unit Weight */}
              <div style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 10, padding: "0.75rem", marginBottom: "0.75rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.5rem", fontWeight: 600 }}>Quantity, Type & Weight</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Quantity</label>
                    <input value={form.qty} onChange={e => set("qty", e.target.value)} inputMode="numeric" placeholder="e.g. 10" />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Unit Type</label>
                    <select value={form.unitType} onChange={e => {
                      const t = e.target.value;
                      set("unitType", t);
                      // Auto-fill weight only if admin hasn't manually set it
                      if (!form.unitWeightKg && DEFAULT_UNIT_WEIGHTS[t]) {
                        set("unitWeightKg", String(DEFAULT_UNIT_WEIGHTS[t]));
                      }
                    }} style={{ width: "100%", fontSize: "0.875rem", padding: "0.5rem 0.6rem" }}>
                      <option value="">— Select type —</option>
                      {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                      Unit Weight (kg)
                      {form.unitType && DEFAULT_UNIT_WEIGHTS[form.unitType] && (
                        <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>
                          · default {DEFAULT_UNIT_WEIGHTS[form.unitType]}
                        </span>
                      )}
                    </label>
                    <input
                      value={form.unitWeightKg}
                      onChange={e => set("unitWeightKg", e.target.value)}
                      inputMode="decimal"
                      placeholder={form.unitType && DEFAULT_UNIT_WEIGHTS[form.unitType]
                        ? String(DEFAULT_UNIT_WEIGHTS[form.unitType])
                        : "kg per unit"}
                    />
                  </div>
                </div>
                <div style={{ marginTop: "0.5rem", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  Strip default: 0.00823 kg · Tube default: 0.0395 kg · Used for parcel weight calculation in quotations
                </div>
              </div>

              {/* Row 6: Pack + MRP + GST + Min Margin + Max Margin */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Pack / Unit</label>
                  <input value={form.pack} onChange={e => set("pack", e.target.value)} placeholder="e.g. 1TAB" />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>MRP (₹)</label>
                  <input value={form.mrp} onChange={e => set("mrp", e.target.value)} inputMode="decimal" placeholder="0.00" />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>GST %</label>
                  <input value={form.gstPercent} onChange={e => set("gstPercent", e.target.value)} inputMode="decimal" placeholder="5" />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Min Margin %</label>
                  <input value={form.minMargin} onChange={e => set("minMargin", e.target.value)} inputMode="decimal" placeholder="e.g. 10" />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Max Margin %</label>
                  <input value={form.maxMargin} onChange={e => set("maxMargin", e.target.value)} inputMode="decimal" placeholder="e.g. 30" />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setModal(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn btn-primary">
                {saving ? "Saving…" : modal === "add" ? "Add Product" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Product Ledger Overlay ── */}
      {ledgerProduct && (
        <ProductLedgerOverlay
          productId={ledgerProduct.id}
          productName={ledgerProduct.name}
          onClose={() => setLedgerProduct(null)}
        />
      )}
    </div>
  );
}
