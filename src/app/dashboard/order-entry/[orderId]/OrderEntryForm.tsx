"use client";

import { useMemo, useState, useEffect } from "react";

type ProductOption = { id: string; name: string };
type ExistingEntry = null | {
  id: string; shipmentMode: string; shippingPrice: any; notes: string | null;
  items: Array<{ id: string; productName: string; quantity: number; sellingPrice: any }>;
};
type Row = { productId: string; quantity: string; sellingPrice: string };

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin" style={{ display: "inline-block" }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── Reusable Input ────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block group cursor-text">
      <span className="text-xs font-medium text-slate-400 group-focus-within:text-blue-400 transition-colors duration-150">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls = [
  "w-full rounded-xl border bg-slate-950/60 px-3 py-2.5 text-slate-100 text-sm",
  "outline-none transition-all duration-150",
  "border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
  "placeholder:text-slate-600 hover:border-slate-600",
].join(" ");

const selectCls = [
  "w-full rounded-xl border bg-slate-950/60 px-3 py-2.5 text-slate-100 text-sm",
  "outline-none transition-all duration-150 cursor-pointer",
  "border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
  "hover:border-slate-600",
].join(" ");

// ── Add Product Modal ─────────────────────────────────────────────────────────
function AddProductModal({ onClose, onAdded }: { onClose: () => void; onAdded: (p: ProductOption) => void }) {
  const [form, setForm]   = useState({ name: "", manufacturer: "", hsn: "", pack: "", mrp: "", gstPercent: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => { const t = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(t); }, []);

  function close() { setVisible(false); setTimeout(onClose, 200); }
  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); if (err) setErr(null); }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  async function handleSave() {
    if (!form.name.trim()) { setErr("Product name is required"); return; }
    setLoading(true); setErr(null);
    const res  = await fetch("/api/products", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        manufacturer: form.manufacturer.trim() || null,
        hsn:          form.hsn.trim()          || null,
        pack:         form.pack.trim()          || null,
        mrp:          form.mrp        ? Number(form.mrp)        : null,
        gstPercent:   form.gstPercent ? Number(form.gstPercent) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data?.error || "Failed to add product"); setLoading(false); }
    else onAdded({ id: data.id, name: data.name });
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) close(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
        backgroundColor: `rgba(0,0,0,${visible ? 0.65 : 0})`,
        backdropFilter: `blur(${visible ? 6 : 0}px)`,
        transition: "background-color 0.2s ease, backdrop-filter 0.2s ease",
      }}
    >
      <div style={{
        width: "100%", maxWidth: 440,
        transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.22s cubic-bezier(0.34,1.4,0.64,1), opacity 0.18s ease",
      }}>
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100 leading-tight">Add New Product</p>
                <p className="text-xs text-slate-500 leading-tight mt-0.5">Saved to Product Master instantly</p>
              </div>
            </div>
            <button
              onClick={close}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-all duration-150 cursor-pointer"
              title="Close (Esc)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-3.5">
            <Field label="Product Name *">
              <input
                autoFocus value={form.name}
                onChange={e => set("name", e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !loading) handleSave(); }}
                placeholder="e.g. TADALAFIL 20MG"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Manufacturer">
                <input value={form.manufacturer} onChange={e => set("manufacturer", e.target.value)} placeholder="e.g. Centurion" className={inputCls} />
              </Field>
              <Field label="HSN Code">
                <input value={form.hsn} onChange={e => set("hsn", e.target.value)} placeholder="e.g. 3004" className={inputCls} />
              </Field>
              <Field label="Pack">
                <input value={form.pack} onChange={e => set("pack", e.target.value)} placeholder="e.g. 10 tablets" className={inputCls} />
              </Field>
              <Field label="MRP (₹)">
                <input value={form.mrp} onChange={e => set("mrp", e.target.value)} inputMode="decimal" placeholder="0.00" className={inputCls} />
              </Field>
            </div>

            <Field label="GST %">
              <input value={form.gstPercent} onChange={e => set("gstPercent", e.target.value)} inputMode="decimal" placeholder="12" className={inputCls} />
            </Field>

            {/* Error banner */}
            {err && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5" style={{ animation: "fadeIn 0.15s ease" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
                </svg>
                <p className="text-xs text-red-300">{err}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2.5 px-6 pb-5">
            <button
              onClick={handleSave} disabled={loading}
              className={[
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150",
                loading
                  ? "bg-blue-700/50 text-white/50 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white shadow-lg shadow-blue-600/25 cursor-pointer",
              ].join(" ")}
            >
              {loading ? <><Spinner size={13} /> Adding...</> : "Add Product"}
            </button>
            <button
              onClick={close} disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-100 hover:bg-slate-800 hover:border-slate-600 text-sm transition-all duration-150 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}

// ── Main Form ─────────────────────────────────────────────────────────────────
export default function OrderEntryForm({
  orderId, products: initialProducts, existingEntry,
}: {
  orderId: string; products: ProductOption[]; existingEntry: ExistingEntry | null;
}) {
  const [products, setProducts]           = useState<ProductOption[]>(initialProducts);
  const [showModal, setShowModal]         = useState(false);
  const [pendingRowIdx, setPendingRowIdx] = useState<number | null>(null);
  const [shipmentMode, setShipmentMode]   = useState(existingEntry?.shipmentMode ?? "EMS");
  const [shippingPrice, setShippingPrice] = useState(existingEntry?.shippingPrice?.toString?.() ?? "0");
  const [notes, setNotes]                 = useState(existingEntry?.notes ?? "");
  const [loading, setLoading]             = useState(false);
  const [ok, setOk]                       = useState<string | null>(null);
  const [err, setErr]                     = useState<string | null>(null);

  const initialRows: Row[] = useMemo(() => {
    if (existingEntry?.items?.length) {
      return existingEntry.items.map(it => {
        const match = initialProducts.find(p => p.name === it.productName);
        return { productId: match?.id ?? "", quantity: String(it.quantity ?? ""), sellingPrice: it.sellingPrice?.toString?.() ?? "" };
      });
    }
    return [{ productId: "", quantity: "", sellingPrice: "" }];
  }, [existingEntry, initialProducts]);

  const [rows, setRows] = useState<Row[]>(initialRows);

  function addRow()                           { setRows(r => [...r, { productId: "", quantity: "", sellingPrice: "" }]); }
  function removeRow(idx: number)             { setRows(r => r.filter((_, i) => i !== idx)); }
  function updateRow(idx: number, p: Partial<Row>) { setRows(r => r.map((row, i) => i === idx ? { ...row, ...p } : row)); }

  function handleProductChange(idx: number, val: string) {
    if (val === "__add_new__") { setPendingRowIdx(idx); setShowModal(true); }
    else updateRow(idx, { productId: val });
  }

  function handleProductAdded(p: ProductOption) {
    setProducts(prev => [...prev, p]);
    if (pendingRowIdx !== null) updateRow(pendingRowIdx, { productId: p.id });
    setPendingRowIdx(null);
    setShowModal(false);
  }

  const orderTotal = useMemo(() =>
    rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.sellingPrice) || 0), 0)
    + (Number(shippingPrice) || 0),
  [rows, shippingPrice]);

  async function submit() {
    setLoading(true); setErr(null); setOk(null);
    const items = rows
      .filter(r => r.productId && r.quantity && r.sellingPrice)
      .map(r => ({ productId: r.productId, quantity: Number(r.quantity), sellingPrice: r.sellingPrice }));
    const res  = await fetch("/api/order-entry", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, shipmentMode, shippingPrice, notes, items }),
    });
    const data = await res.json();
    if (!res.ok) setErr(data?.error || "Failed to save");
    else setOk("Order entry saved successfully");
    setLoading(false);
  }

  return (
    <>
      {showModal && (
        <AddProductModal
          onClose={() => { setShowModal(false); setPendingRowIdx(null); }}
          onAdded={handleProductAdded}
        />
      )}

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 max-w-4xl">

        {/* Top fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Shipment Mode">
            <select value={shipmentMode} onChange={e => setShipmentMode(e.target.value)} className={selectCls}>
              {["EMS","ITPS","RMS","DHL"].map(m => <option key={m}>{m}</option>)}
            </select>
          </Field>

          <Field label="Shipping Price (₹)">
            <input value={shippingPrice} onChange={e => setShippingPrice(e.target.value)} inputMode="decimal" placeholder="0" className={inputCls} />
          </Field>

          <div className="md:col-span-3">
            <Field label="Notes">
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special packing instructions…" className={inputCls} />
            </Field>
          </div>
        </div>

        {/* Items section */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-200">Items</h3>
            <button
              type="button" onClick={addRow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700/60 hover:border-slate-600 text-slate-300 text-sm font-medium transition-all duration-150 cursor-pointer active:scale-95"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
              Add Item
            </button>
          </div>

          <div className="space-y-2">
            {rows.map((r, idx) => {
              const rowTotal = (Number(r.quantity) || 0) * (Number(r.sellingPrice) || 0);
              return (
                <div key={idx} className="grid grid-cols-12 gap-2.5 rounded-xl border border-slate-800 bg-slate-950/40 hover:border-slate-700/80 p-3 transition-colors duration-150 group">

                  {/* Product */}
                  <div className="col-span-12 md:col-span-6">
                    <label className="text-xs font-medium text-slate-500">Product</label>
                    <select
                      value={r.productId}
                      onChange={e => handleProductChange(idx, e.target.value)}
                      className={selectCls + " mt-1"}
                    >
                      <option value="">Select product…</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      <option disabled>──────────────</option>
                      <option value="__add_new__">✦ Add New Product</option>
                    </select>
                  </div>

                  {/* Qty */}
                  <div className="col-span-4 md:col-span-2">
                    <label className="text-xs font-medium text-slate-500">Qty</label>
                    <input
                      value={r.quantity} onChange={e => updateRow(idx, { quantity: e.target.value })}
                      inputMode="numeric" placeholder="1"
                      className={inputCls + " mt-1"}
                    />
                  </div>

                  {/* Price */}
                  <div className="col-span-5 md:col-span-3">
                    <label className="text-xs font-medium text-slate-500">Selling Price (₹)</label>
                    <input
                      value={r.sellingPrice} onChange={e => updateRow(idx, { sellingPrice: e.target.value })}
                      inputMode="decimal" placeholder="0.00"
                      className={inputCls + " mt-1"}
                    />
                  </div>

                  {/* Row total + delete */}
                  <div className="col-span-3 md:col-span-1 flex flex-col items-end justify-between pt-1 pb-0.5">
                    <span className="text-xs text-slate-600 font-mono tabular-nums">
                      {rowTotal > 0 ? `₹${rowTotal.toFixed(2)}` : ""}
                    </span>
                    <button
                      type="button" onClick={() => removeRow(idx)}
                      disabled={rows.length === 1}
                      title="Remove row"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-150 cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order total */}
        <div className="mt-4 flex justify-end">
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2.5">
            <span className="text-xs text-slate-500">Order Total</span>
            <span className="text-base font-bold text-slate-100 tabular-nums">
              ₹{orderTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Save + status */}
        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <button
            disabled={loading} onClick={submit}
            className={[
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150",
              loading
                ? "bg-blue-700/50 text-white/50 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white shadow-lg shadow-blue-600/20 cursor-pointer",
            ].join(" ")}
          >
            {loading ? (
              <><Spinner size={13} /> Saving...</>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeLinecap="round"/>
                  <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                </svg>
                Save Entry
              </>
            )}
          </button>

          {err && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2" style={{ animation: "fadeIn 0.15s ease" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
              </svg>
              <p className="text-xs text-red-300">{err}</p>
            </div>
          )}
          {ok && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2" style={{ animation: "fadeIn 0.15s ease" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400 shrink-0">
                <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-xs text-emerald-300">{ok}</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-spin {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}