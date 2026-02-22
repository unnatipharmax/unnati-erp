"use client";

import { useMemo, useState } from "react";

type ProductOption = { id: string; name: string };

type ExistingEntry = null | {
  id: string;
  shipmentMode: string;
  shippingPrice: any;
  notes: string | null;
  items: Array<{ id: string; productName: string; quantity: number; sellingPrice: any }>;
};

type Row = {
  productId: string;
  quantity: string;
  sellingPrice: string;
};

// ── Add Product Modal ─────────────────────────────────────────────────────────
function AddProductModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (product: ProductOption) => void;
}) {
  const [form, setForm] = useState({
    name: "", manufacturer: "", hsn: "", pack: "",
    mrp: "", gstPercent: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  function set(field: string, val: string) {
    setForm(f => ({ ...f, [field]: val }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setErr("Product name is required"); return; }
    setLoading(true); setErr(null);

    const res  = await fetch("/api/products", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name:         form.name.trim(),
        manufacturer: form.manufacturer.trim() || null,
        hsn:          form.hsn.trim()          || null,
        pack:         form.pack.trim()          || null,
        mrp:          form.mrp      ? Number(form.mrp)      : null,
        gstPercent:   form.gstPercent ? Number(form.gstPercent) : null,
      }),
    });

    const data = await res.json();
    if (!res.ok) { setErr(data?.error || "Failed to add product"); }
    else         { onAdded({ id: data.id, name: data.name }); }
    setLoading(false);
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-100">Add New Product</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 text-xl leading-none"
          >×</button>
        </div>

        <div className="space-y-3">
          {/* Name — required */}
          <div>
            <label className="text-xs text-slate-400">Product Name *</label>
            <input
              autoFocus
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="e.g. TADALAFIL 20MG"
              className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Manufacturer</label>
              <input
                value={form.manufacturer}
                onChange={e => set("manufacturer", e.target.value)}
                placeholder="e.g. Centurion"
                className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">HSN Code</label>
              <input
                value={form.hsn}
                onChange={e => set("hsn", e.target.value)}
                placeholder="e.g. 3004"
                className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Pack</label>
              <input
                value={form.pack}
                onChange={e => set("pack", e.target.value)}
                placeholder="e.g. 10 tablets"
                className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">MRP (₹)</label>
              <input
                value={form.mrp}
                onChange={e => set("mrp", e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">GST %</label>
              <input
                value={form.gstPercent}
                onChange={e => set("gstPercent", e.target.value)}
                inputMode="decimal"
                placeholder="12"
                className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {err && <p className="text-sm text-red-400 mt-3">{err}</p>}

        <div className="flex gap-3 mt-5">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold transition"
          >
            {loading ? "Adding..." : "Add Product"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Form ─────────────────────────────────────────────────────────────────
export default function OrderEntryForm({
  orderId,
  products: initialProducts,
  existingEntry,
}: {
  orderId: string;
  products: ProductOption[];
  existingEntry: ExistingEntry | null;
}) {
  const [products, setProducts] = useState<ProductOption[]>(initialProducts);
  const [showModal, setShowModal] = useState(false);
  const [pendingRowIdx, setPendingRowIdx] = useState<number | null>(null);

  const [shipmentMode, setShipmentMode] = useState(existingEntry?.shipmentMode ?? "EMS");
  const [shippingPrice, setShippingPrice] = useState(
    existingEntry?.shippingPrice?.toString?.() ?? "0"
  );
  const [notes, setNotes] = useState(existingEntry?.notes ?? "");

  const initialRows: Row[] = useMemo(() => {
    if (existingEntry?.items?.length) {
      return existingEntry.items.map((it) => {
        const match = products.find((p) => p.name === it.productName);
        return {
          productId:    match?.id ?? "",
          quantity:     String(it.quantity ?? ""),
          sellingPrice: it.sellingPrice?.toString?.() ?? "",
        };
      });
    }
    return [{ productId: "", quantity: "", sellingPrice: "" }];
  }, [existingEntry, initialProducts]);

  const [rows, setRows]     = useState<Row[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [ok, setOk]           = useState<string | null>(null);
  const [err, setErr]         = useState<string | null>(null);

  function addRow() {
    setRows(r => [...r, { productId: "", quantity: "", sellingPrice: "" }]);
  }

  function removeRow(idx: number) {
    setRows(r => r.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, patch: Partial<Row>) {
    setRows(r => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  // Called when user picks "add-new" from dropdown
  function handleProductChange(idx: number, value: string) {
    if (value === "__add_new__") {
      setPendingRowIdx(idx);
      setShowModal(true);
    } else {
      updateRow(idx, { productId: value });
    }
  }

  // Called when modal successfully creates a product
  function handleProductAdded(newProduct: ProductOption) {
    setProducts(prev => [...prev, newProduct]);
    if (pendingRowIdx !== null) {
      updateRow(pendingRowIdx, { productId: newProduct.id });
    }
    setPendingRowIdx(null);
    setShowModal(false);
  }

  async function submit() {
    setLoading(true); setErr(null); setOk(null);

    const items = rows
      .filter(r => r.productId && r.quantity && r.sellingPrice)
      .map(r => ({
        productId:    r.productId,
        quantity:     Number(r.quantity),
        sellingPrice: r.sellingPrice,
      }));

    const res  = await fetch("/api/order-entry", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ orderId, shipmentMode, shippingPrice, notes, items }),
    });

    const data = await res.json();
    if (!res.ok) setErr(data?.error || "Failed to save order entry");
    else         setOk("Saved successfully");

    setLoading(false);
  }

  return (
    <>
      {/* ── Add Product Modal ── */}
      {showModal && (
        <AddProductModal
          onClose={() => { setShowModal(false); setPendingRowIdx(null); }}
          onAdded={handleProductAdded}
        />
      )}

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-400">Shipment Mode</label>
            <select
              value={shipmentMode}
              onChange={e => setShipmentMode(e.target.value)}
              className="w-full mt-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="EMS">EMS</option>
              <option value="ITPS">ITPS</option>
              <option value="RMS">RMS</option>
              <option value="DHL">DHL</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400">Shipping Price</label>
            <input
              value={shippingPrice}
              onChange={e => setShippingPrice(e.target.value)}
              inputMode="decimal"
              className="w-full mt-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="0"
            />
          </div>

          <div className="md:col-span-3">
            <label className="text-xs text-slate-400">Notes</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full mt-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Special packing instructions…"
            />
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Items</h3>
            <button
              type="button"
              onClick={addRow}
              className="px-4 py-2 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-950/70 text-slate-100 font-semibold"
            >
              + Add Item
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {rows.map((r, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3"
              >
                <div className="md:col-span-6">
                  <label className="text-xs text-slate-400">Product</label>
                  <select
                    value={r.productId}
                    onChange={e => handleProductChange(idx, e.target.value)}
                    className="w-full mt-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">Select product…</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    {/* ── Add new option at bottom ── */}
                    <option disabled>──────────────</option>
                    <option value="__add_new__">+ Add New Product</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-slate-400">Qty</label>
                  <input
                    value={r.quantity}
                    onChange={e => updateRow(idx, { quantity: e.target.value })}
                    inputMode="numeric"
                    className="w-full mt-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="1"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="text-xs text-slate-400">Selling Price</label>
                  <input
                    value={r.sellingPrice}
                    onChange={e => updateRow(idx, { sellingPrice: e.target.value })}
                    inputMode="decimal"
                    className="w-full mt-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="0"
                  />
                </div>

                <div className="md:col-span-1 flex md:items-end">
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="w-full md:w-auto px-3 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-200 font-semibold"
                  >
                    X
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            disabled={loading}
            onClick={submit}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed font-semibold text-white"
          >
            {loading ? "Saving..." : "Save Entry"}
          </button>
          {err && <p className="text-sm text-red-400">{err}</p>}
          {ok  && <p className="text-sm text-green-400">{ok}</p>}
        </div>
      </div>
    </>
  );
}