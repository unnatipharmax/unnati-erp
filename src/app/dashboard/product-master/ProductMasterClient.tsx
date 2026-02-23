"use client";
import { useState, useEffect } from "react";

type Product = {
  id: string; name: string; manufacturer: string | null;
  hsn: string | null; pack: string | null; mrp: number | null;
  gstPercent: number | null; composition: string | null;
  batchNo: string | null; mfgDate: string | null; expDate: string | null;
  latestRate: number | null; inrUnit: number | null; createdAt: string;
};

const EMPTY = {
  name: "", manufacturer: "", hsn: "", pack: "",
  mrp: "", gstPercent: "", composition: "",
  batchNo: "", mfgDate: "", expDate: "",
};

export default function ProductMasterClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [modal,    setModal]    = useState<"add" | "edit" | null>(null);
  const [editing,  setEditing]  = useState<Product | null>(null);
  const [form,     setForm]     = useState({ ...EMPTY });
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/products");
    const data = await res.json();
    setProducts(data.products ?? []);
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
    setModal(null);
    setSaving(false);
    load();
  }

  async function del(id: string) {
    if (!confirm("Delete this product?")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = products.filter(p =>
    [p.name, p.manufacturer, p.hsn, p.composition, p.batchNo]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1>Product Master</h1>
          <p style={{ marginTop: "0.25rem" }}>{products.length} products</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, composition, batch..."
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
          <table style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Composition</th>
                <th>Manufacturer</th>
                <th>HSN</th>
                <th>Pack</th>
                <th>Batch No</th>
                <th>Mfg Date</th>
                <th>Exp Date</th>
                <th style={{ textAlign: "right" }}>MRP</th>
                <th style={{ textAlign: "right" }}>GST %</th>
                <th style={{ textAlign: "right" }}>Purchase Rate</th>
                <th style={{ textAlign: "right" }}>INR Unit (+15%)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{p.composition ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{p.manufacturer ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{p.hsn ?? "—"}</td>
                  <td>{p.pack ?? "—"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {p.batchNo
                      ? <span className="badge badge-blue" style={{ fontSize: "0.7rem" }}>{p.batchNo}</span>
                      : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td style={{ fontSize: "0.8rem" }}>{p.mfgDate ?? "—"}</td>
                  <td style={{ fontSize: "0.8rem" }}>
                    {p.expDate
                      ? <span className="badge badge-amber" style={{ fontSize: "0.7rem" }}>{p.expDate}</span>
                      : "—"}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {p.mrp != null ? `₹${p.mrp}` : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>{p.gstPercent != null ? `${p.gstPercent}%` : "—"}</td>
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
          <div className="modal" style={{ maxWidth: 640, width: "100%" }}>
            <div className="modal-header">
              <h3>{modal === "add" ? "Add Product" : "Edit Product"}</h3>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.25rem", cursor: "pointer" }}>✕</button>
            </div>
            <div className="modal-body">
              {err && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{err}</div>}

              {/* Row 1 */}
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

              {/* Row 2 */}
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

              {/* Row 3 — Batch / Mfg / Exp */}
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

              {/* Row 4 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.75rem" }}>
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
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>INR Unit Rate</label>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", padding: "0.5rem 0" }}>
                    Auto from purchase bill + 15%
                  </div>
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
    </div>
  );
}