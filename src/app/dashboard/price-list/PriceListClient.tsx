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
  isOverride?: boolean;
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
  const [showAdd, setShowAdd]       = useState(false);
  const [showGroups, setShowGroups] = useState(false);

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
          {canEdit && (
            <button onClick={() => setShowGroups(true)} className="btn btn-secondary btn-sm">
              ⚙ Group Margins
            </button>
          )}
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
                      <span className="inline-flex items-center gap-1 mt-1">
                        {item.group && (
                          <span className="text-xs text-violet-600 bg-violet-500/10 border border-violet-500/20 rounded-md px-1.5 py-0.5">
                            {item.group}
                          </span>
                        )}
                        {canEdit && item.isOverride && (
                          <span className="text-xs text-amber-700 bg-amber-100 border border-amber-300 rounded-md px-1.5 py-0.5">
                            custom price
                          </span>
                        )}
                      </span>
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
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); load(); }}
        />
      )}

      {showGroups && (
        <GroupMarginsModal
          onClose={() => setShowGroups(false)}
          onApplied={load}
        />
      )}
    </div>
  );
}

// ── Group Margins modal — set DEFAULT Min%/Max% per group (inherited) ──────────
type GroupRow = { id: string; name: string; total: number; overrides?: number; defaultMinMargin?: number | null; defaultMaxMargin?: number | null };

function GroupMarginsModal({ onClose, onApplied }: { onClose: () => void; onApplied: () => void }) {
  const [rows, setRows]   = useState<GroupRow[]>([]);
  const [ung, setUng]     = useState<{ total: number }>({ total: 0 });
  const [vals, setVals]   = useState<Record<string, { min: string; max: string }>>({});
  const [busyId, setBusyId]       = useState<string | null>(null);
  const [msg, setMsg]     = useState("");

  async function loadGroups() {
    const r = await fetch("/api/price-list/group-margins");
    const d = await r.json();
    const groups: GroupRow[] = d.groups ?? [];
    setRows(groups);
    setUng(d.ungrouped ?? { total: 0 });
    // Prefill inputs from existing group defaults
    setVals(prev => {
      const next = { ...prev };
      for (const g of groups) {
        if (next[g.id] === undefined) {
          next[g.id] = {
            min: g.defaultMinMargin != null ? String(g.defaultMinMargin) : "",
            max: g.defaultMaxMargin != null ? String(g.defaultMaxMargin) : "",
          };
        }
      }
      return next;
    });
  }
  useEffect(() => { loadGroups(); }, []);

  function setVal(id: string, key: "min" | "max", v: string) {
    setVals(prev => ({ ...prev, [id]: { min: prev[id]?.min ?? "", max: prev[id]?.max ?? "", [key]: v } }));
  }

  async function apply(groupId: string, label: string) {
    const v = vals[groupId] ?? { min: "", max: "" };
    if (!v.min && !v.max) { setMsg("Enter a min or max % first"); return; }
    setBusyId(groupId); setMsg("");
    try {
      const res = await fetch("/api/price-list/group-margins", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, minMargin: v.min, maxMargin: v.max }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg(d?.error || "Failed"); }
      else {
        setMsg(`✓ ${label} margins saved`);
        await loadGroups();
        onApplied();
      }
    } catch { setMsg("Network error"); }
    setBusyId(null);
  }

  // Plain render helper (not a component) so inputs keep focus across renders
  const renderRow = ({ id, name, total, overrides }: GroupRow) => {
    const v = vals[id] ?? { min: "", max: "" };
    return (
      <div key={id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 70px", gap: 8, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--border)" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{name}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
            {total} product{total !== 1 ? "s" : ""}{overrides ? ` · ${overrides} custom` : ""}
          </div>
        </div>
        <input type="number" value={v.min} onChange={e => setVal(id, "min", e.target.value)} placeholder="Min %" style={{ padding: "5px 8px", fontSize: "0.8rem" }} />
        <input type="number" value={v.max} onChange={e => setVal(id, "max", e.target.value)} placeholder="Max %" style={{ padding: "5px 8px", fontSize: "0.8rem" }} />
        <button onClick={() => apply(id, name)} disabled={busyId === id || total === 0} className="btn btn-primary btn-sm" style={{ fontSize: "0.72rem", padding: "4px 8px" }}>
          {busyId === id ? "…" : "Save"}
        </button>
      </div>
    );
  };

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0 }}>Group Margins</h3>
            <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Default Min% / Max% per category. Every product in the group inherits these
              (Price = MRP × (1 + %)) — including products added later. A product&apos;s own
              Edit overrides its group default.
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon">✕</button>
        </div>

        <div className="modal-body" style={{ overflowY: "auto" }}>
          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 70px", gap: 8, padding: "4px 0", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", fontWeight: 700 }}>
            <div>Group</div><div>Min %</div><div>Max %</div><div></div>
          </div>

          {rows.map(r => renderRow(r))}
          {ung.total > 0 && renderRow({ id: "UNGROUPED", name: "— Ungrouped —", total: ung.total })}

          {rows.length === 0 && ung.total === 0 && (
            <div style={{ padding: "1rem 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>No product groups yet.</div>
          )}
          {ung.total > 0 && (
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 8 }}>
              Ungrouped products can&apos;t inherit a default — assign them to a group, or set their price via Edit.
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.78rem", color: msg.startsWith("✓") ? "#047857" : "var(--text-secondary)" }}>{msg}</span>
          <button onClick={onClose} className="btn btn-secondary">Done</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Product modal (full product details — same fields as Product Master,
//    without price/margins; admin sets Min/Max % later) ────────────────────────
type Group = { id: string; name: string };
const UNIT_TYPES = ["Strip","Tube","Bottle","Sachet","Vial","Ampoule","Box","Inhaler","Cream","Ointment","Syrup","Drops","Spray","Injection","Patch","Tablet","Capsule"];

function AddProductModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "", composition: "", manufacturer: "", hsn: "", pack: "",
    batchNo: "", mfgDate: "", expDate: "",
    qty: "", unitType: "", unitWeightKg: "",
    mrp: "", gstPercent: "", groupId: "",
  });
  const [groups, setGroups] = useState<Group[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/product-groups").then(r => r.json()).then(d => setGroups(d.groups ?? [])).catch(() => {});
  }, []);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.name.trim()) { setErr("Product name is required"); return; }
    setSaving(true); setErr("");

    // No min/max margins — product lists with null prices until admin sets them
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      composition: form.composition.trim() || null,
      manufacturer: form.manufacturer.trim() || null,
      hsn: form.hsn.trim() || null,
      pack: form.pack.trim() || null,
      batchNo: form.batchNo.trim() || null,
      mfgDate: form.mfgDate.trim() || null,
      expDate: form.expDate.trim() || null,
      qty: form.qty || null,
      unitType: form.unitType || null,
      unitWeightKg: form.unitWeightKg || null,
      mrp: form.mrp || null,
      gstPercent: form.gstPercent || null,
      groupId: form.groupId || null,
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
      <div className="modal" style={{ maxWidth: 560, maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Add Product</h3>
          <button onClick={onClose} className="btn btn-ghost btn-icon">✕</button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", overflowY: "auto" }}>
          <Labelled label="Product Name *">
            <input autoFocus value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. MORNING PILLS" />
          </Labelled>
          <Labelled label="Composition">
            <input value={form.composition} onChange={e => set("composition", e.target.value)} placeholder="e.g. LEVONORGESTREL TAB 1.5" />
          </Labelled>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <Labelled label="Manufacturer">
              <input value={form.manufacturer} onChange={e => set("manufacturer", e.target.value)} placeholder="e.g. HEALING PHARMA" />
            </Labelled>
            <Labelled label="HSN Code">
              <input value={form.hsn} onChange={e => set("hsn", e.target.value)} placeholder="e.g. 30059060" />
            </Labelled>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            <Labelled label="Batch No"><input value={form.batchNo} onChange={e => set("batchNo", e.target.value)} placeholder="e.g. DH250092B" /></Labelled>
            <Labelled label="Mfg Date"><input value={form.mfgDate} onChange={e => set("mfgDate", e.target.value)} placeholder="e.g. Jul-25" /></Labelled>
            <Labelled label="Exp Date"><input value={form.expDate} onChange={e => set("expDate", e.target.value)} placeholder="e.g. Jun-27" /></Labelled>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            <Labelled label="Qty / Pack"><input value={form.qty} onChange={e => set("qty", e.target.value)} inputMode="numeric" placeholder="e.g. 10" /></Labelled>
            <Labelled label="Unit Type">
              <select value={form.unitType} onChange={e => set("unitType", e.target.value)}>
                <option value="">—</option>
                {UNIT_TYPES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </Labelled>
            <Labelled label="Unit Wt (kg)"><input value={form.unitWeightKg} onChange={e => set("unitWeightKg", e.target.value)} inputMode="decimal" placeholder="0.00823" /></Labelled>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            <Labelled label="Pack / Unit"><input value={form.pack} onChange={e => set("pack", e.target.value)} placeholder="e.g. 1TAB" /></Labelled>
            <Labelled label="MRP (₹)"><input value={form.mrp} onChange={e => set("mrp", e.target.value)} inputMode="decimal" placeholder="0.00" /></Labelled>
            <Labelled label="GST %"><input value={form.gstPercent} onChange={e => set("gstPercent", e.target.value)} inputMode="decimal" placeholder="5" /></Labelled>
          </div>

          <Labelled label="Group">
            <select value={form.groupId} onChange={e => set("groupId", e.target.value)}>
              <option value="">— No Group —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Labelled>

          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            Min / Max selling price will be set by the admin afterwards.
          </div>

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
