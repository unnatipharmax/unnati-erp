"use client";

import { useState, useMemo } from "react";

type Product = {
  id:           string;
  name:         string;
  manufacturer: string | null;
  hsn:          string | null;
  pack:         string | null;
  mrp:          number | null;
  gstPercent:   number | null;
  createdAt:    string;
};

type FormState = {
  name: string; manufacturer: string; hsn: string;
  pack: string; mrp: string; gstPercent: string;
};

const emptyForm: FormState = { name: "", manufacturer: "", hsn: "", pack: "", mrp: "", gstPercent: "" };

// ── Add Product Modal ─────────────────────────────────────────────────────────
function AddProductModal({ onClose, onAdded }: { onClose: () => void; onAdded: (p: Product) => void }) {
  const [form, setForm]       = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  function set(k: keyof FormState, v: string) { setForm(f => ({ ...f, [k]: v })); if (err) setErr(null); }

  async function handleSave() {
    if (!form.name.trim()) { setErr("Product name is required"); return; }
    setLoading(true); setErr(null);
    const res  = await fetch("/api/products", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:         form.name.trim(),
        manufacturer: form.manufacturer.trim() || null,
        hsn:          form.hsn.trim()          || null,
        pack:         form.pack.trim()          || null,
        mrp:          form.mrp        ? Number(form.mrp)        : null,
        gstPercent:   form.gstPercent ? Number(form.gstPercent) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data?.error || "Failed"); setLoading(false); }
    else onAdded({ ...data, mrp: data.mrp ? Number(data.mrp) : null, gstPercent: data.gstPercent ? Number(data.gstPercent) : null, createdAt: new Date().toISOString() });
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: "rgba(59,130,246,0.15)",
              border: "1px solid rgba(59,130,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Add New Product</h3>
              <p style={{ margin: 0, fontSize: "0.75rem" }}>Saved to Product Master instantly</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon" title="Close (Esc)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Product Name *</label>
            <input autoFocus value={form.name} onChange={e => set("name", e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSave()} placeholder="e.g. TADALAFIL 20MG" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {([
              ["manufacturer", "Manufacturer", "e.g. Centurion"],
              ["hsn",          "HSN Code",     "e.g. 3004"],
              ["pack",         "Pack",         "e.g. 10 tablets"],
              ["mrp",          "MRP (₹)",      "0.00"],
              ["gstPercent",   "GST %",        "12"],
            ] as [keyof FormState, string, string][]).map(([key, label, placeholder]) => (
              <div key={key}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{label}</label>
                <input value={form[key]} onChange={e => set(key, e.target.value)}
                  placeholder={placeholder}
                  inputMode={["mrp","gstPercent"].includes(key) ? "decimal" : undefined as any} />
              </div>
            ))}
          </div>

          {err && (
            <div className="alert alert-error">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
              </svg>
              {err}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={handleSave} disabled={loading} className="btn btn-primary" style={{ flex: 1 }}>
            {loading ? "Adding…" : "Add Product"}
          </button>
          <button onClick={onClose} disabled={loading} className="btn btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Client Component ─────────────────────────────────────────────────────
export default function ProductMasterClient({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch]       = useState("");
  const [deleting, setDeleting]   = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.manufacturer ?? "").toLowerCase().includes(q) ||
      (p.hsn ?? "").toLowerCase().includes(q)
    );
  }, [products, search]);

  function handleAdded(p: Product) {
    setProducts(prev => [p, ...prev]);
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    setDeleting(id);
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    setProducts(prev => prev.filter(p => p.id !== id));
    setDeleting(null);
  }

  return (
    <>
      {showModal && <AddProductModal onClose={() => setShowModal(false)} onAdded={handleAdded} />}

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <input
          placeholder="Search by name, manufacturer, HSN…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 340 }}
        />
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            {filtered.length} product{filtered.length !== 1 ? "s" : ""}
          </span>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
            </svg>
            Add Product
          </button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
          {search ? `No products matching "${search}"` : "No products yet. Add your first product above."}
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product Name</th>
                <th>Manufacturer</th>
                <th>HSN</th>
                <th>Pack</th>
                <th>MRP (₹)</th>
                <th>GST %</th>
                <th>Added On</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id}>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{p.manufacturer ?? "—"}</td>
                  <td>
                    {p.hsn
                      ? <span className="badge badge-gray">{p.hsn}</span>
                      : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>{p.pack ?? "—"}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>
                    {p.mrp != null
                      ? <span className="badge badge-amber">₹{p.mrp.toLocaleString("en-IN")}</span>
                      : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td>
                    {p.gstPercent != null
                      ? <span className="badge badge-blue">{p.gstPercent}%</span>
                      : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                    {new Date(p.createdAt).toLocaleDateString("en-IN")}
                  </td>
                  <td>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deleting === p.id}
                      className="btn btn-danger btn-sm btn-icon"
                      title="Delete product"
                    >
                      {deleting === p.id ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="animate-spin">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                        </svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}