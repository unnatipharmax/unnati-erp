"use client";

import { useState, useEffect, useMemo } from "react";

type PriceItem = {
  id: string;
  name: string;
  composition: string | null;
  manufacturer: string | null;
  pack: string | null;
  group: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  hasMargins: boolean;
};

function fmt(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PriceListClient({ role }: { role?: string }) {
  const canEdit = role === "ADMIN" || role === "MANAGER";

  const [items, setItems]       = useState<PriceItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [showAdd, setShowAdd]   = useState(false);

  // Inline edit state
  const [editId, setEditId]     = useState<string | null>(null);
  const [editMin, setEditMin]   = useState("");
  const [editMax, setEditMax]   = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/price-list")
      .then(r => r.json())
      .then(data => { setItems(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const groups = useMemo(() => {
    const s = new Set<string>();
    items.forEach(i => { if (i.group) s.add(i.group); });
    return ["ALL", ...Array.from(s).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter(i => {
      if (groupFilter !== "ALL" && i.group !== groupFilter) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        (i.composition?.toLowerCase().includes(q) ?? false) ||
        (i.manufacturer?.toLowerCase().includes(q) ?? false) ||
        (i.pack?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, search, groupFilter]);

  function startEdit(item: PriceItem) {
    setEditId(item.id);
    setEditMin(item.minPrice != null ? String(item.minPrice) : "");
    setEditMax(item.maxPrice != null ? String(item.maxPrice) : "");
  }

  async function saveEdit(id: string) {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/price-list/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minPrice: editMin, maxPrice: editMax }),
      });
      const data = await res.json();
      if (res.ok) {
        setItems(prev => prev.map(it => it.id === id ? { ...it, minPrice: data.minPrice, maxPrice: data.maxPrice, hasMargins: true } : it));
        setEditId(null);
      } else {
        alert(data?.error || "Failed to save");
      }
    } catch {
      alert("Network error");
    }
    setSavingEdit(false);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Price List</h1>
          <p className="text-sm text-slate-500 mt-1">
            Selling price range for each product. Do not share MRP with clients.
          </p>
        </div>
        <div className="flex items-center gap-3 self-center">
          <div className="text-xs text-slate-500 bg-slate-100 border border-slate-300 rounded-xl px-3 py-2">
            {filtered.length} of {items.length} products
          </div>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary btn-sm">
            ＋ Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, composition, manufacturer…"
          className="flex-1 min-w-[220px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
        />
        {groups.length > 2 && (
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            {groups.map(g => <option key={g}>{g}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">No products found</div>
      ) : (
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-medium w-8">#</th>
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Pack</th>
                <th className="px-4 py-3 text-right font-medium">Min Price (₹)</th>
                <th className="px-4 py-3 text-right font-medium">Max Price (₹)</th>
                {canEdit && <th className="px-4 py-3 text-right font-medium w-24"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => {
                const editing = editId === item.id;
                return (
                  <tr key={item.id} className="border-t border-slate-200 hover:bg-slate-50 transition-colors duration-100">
                    <td className="px-4 py-3 text-slate-600 tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 leading-snug">{item.name.toUpperCase()}</div>
                      {item.composition && <div className="text-xs text-slate-500 mt-0.5">{item.composition}</div>}
                      {item.manufacturer && <div className="text-xs text-slate-600 mt-0.5">{item.manufacturer}</div>}
                      {item.group && (
                        <span className="inline-block mt-1 text-xs text-violet-600 bg-violet-500/10 border border-violet-500/20 rounded-md px-1.5 py-0.5">
                          {item.group}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{item.pack ?? "—"}</td>

                    {/* Min Price */}
                    <td className="px-4 py-3 text-right">
                      {editing ? (
                        <input
                          type="number" value={editMin} onChange={e => setEditMin(e.target.value)}
                          placeholder="Min" min="0" step="0.01"
                          className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-right text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      ) : item.minPrice != null ? (
                        <span className="font-semibold text-emerald-600 tabular-nums">₹{fmt(item.minPrice)}</span>
                      ) : <span className="text-slate-600">—</span>}
                    </td>

                    {/* Max Price */}
                    <td className="px-4 py-3 text-right">
                      {editing ? (
                        <input
                          type="number" value={editMax} onChange={e => setEditMax(e.target.value)}
                          placeholder="Max" min="0" step="0.01"
                          className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-right text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      ) : item.maxPrice != null ? (
                        <span className="font-semibold text-blue-600 tabular-nums">₹{fmt(item.maxPrice)}</span>
                      ) : <span className="text-slate-600">—</span>}
                    </td>

                    {/* Edit actions */}
                    {canEdit && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {editing ? (
                          <span className="flex gap-1.5 justify-end">
                            <button disabled={savingEdit} onClick={() => saveEdit(item.id)} className="btn btn-primary btn-sm" style={{ fontSize: "0.72rem", padding: "2px 10px" }}>
                              {savingEdit ? "…" : "Save"}
                            </button>
                            <button onClick={() => setEditId(null)} className="btn btn-secondary btn-sm" style={{ fontSize: "0.72rem", padding: "2px 8px" }}>✕</button>
                          </span>
                        ) : (
                          <button onClick={() => startEdit(item)} className="btn btn-secondary btn-sm" style={{ fontSize: "0.72rem", padding: "2px 10px" }}>Edit</button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex gap-4 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60 inline-block" />
          Min Price — lowest you should quote
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500/60 inline-block" />
          Max Price — standard selling price
        </span>
      </div>

      {showAdd && (
        <AddProductModal
          canSetPrice={canEdit}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Add Product modal ─────────────────────────────────────────────────────────
function AddProductModal({ canSetPrice, onClose, onCreated }: {
  canSetPrice: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "", composition: "", manufacturer: "", hsn: "", pack: "",
    mrp: "", minPrice: "", maxPrice: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.name.trim()) { setErr("Product name is required"); return; }
    setSaving(true); setErr("");

    // Derive margins from MRP + entered min/max price (so they show in the price list)
    const mrpNum = form.mrp ? Number(form.mrp) : null;
    const minP   = form.minPrice ? Number(form.minPrice) : null;
    const maxP   = form.maxPrice ? Number(form.maxPrice) : null;
    const base   = (mrpNum && mrpNum > 0) ? mrpNum : (maxP ?? minP ?? null);

    let minMargin: number | null = null;
    let maxMargin: number | null = null;
    if (base && base > 0) {
      if (minP != null) minMargin = parseFloat(((minP / base - 1) * 100).toFixed(4));
      if (maxP != null) maxMargin = parseFloat(((maxP / base - 1) * 100).toFixed(4));
    }

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      composition: form.composition.trim() || null,
      manufacturer: form.manufacturer.trim() || null,
      hsn: form.hsn.trim() || null,
      pack: form.pack.trim() || null,
      mrp: base ?? null,            // seed MRP so price list can show the range
      minMargin, maxMargin,
    };

    try {
      const res = await fetch("/api/products", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data?.error || "Failed to add product"); setSaving(false); return; }
      onCreated();
    } catch {
      setErr("Network error"); setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Add Product</h3>
          <button onClick={onClose} className="btn btn-ghost btn-icon">✕</button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <Labelled label="Product Name *">
            <input autoFocus value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. TADALAFIL 20MG" />
          </Labelled>
          <Labelled label="Composition">
            <input value={form.composition} onChange={e => set("composition", e.target.value)} placeholder="e.g. Tadalafil 20mg" />
          </Labelled>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <Labelled label="Manufacturer">
              <input value={form.manufacturer} onChange={e => set("manufacturer", e.target.value)} />
            </Labelled>
            <Labelled label="Pack">
              <input value={form.pack} onChange={e => set("pack", e.target.value)} placeholder="e.g. 10 tablets" />
            </Labelled>
            <Labelled label="HSN">
              <input value={form.hsn} onChange={e => set("hsn", e.target.value)} placeholder="3004" />
            </Labelled>
            <Labelled label="MRP (₹)">
              <input type="number" value={form.mrp} onChange={e => set("mrp", e.target.value)} placeholder="0.00" />
            </Labelled>
          </div>
          {canSetPrice && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <Labelled label="Min Price (₹)">
                <input type="number" value={form.minPrice} onChange={e => set("minPrice", e.target.value)} placeholder="lowest quote" />
              </Labelled>
              <Labelled label="Max Price (₹)">
                <input type="number" value={form.maxPrice} onChange={e => set("maxPrice", e.target.value)} placeholder="standard price" />
              </Labelled>
            </div>
          )}
          {err && <div className="alert alert-error" style={{ fontSize: "0.8rem" }}>{err}</div>}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          <button onClick={save} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
            {saving ? "Saving…" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <div style={{ marginTop: 4 }}>{children}</div>
    </label>
  );
}
