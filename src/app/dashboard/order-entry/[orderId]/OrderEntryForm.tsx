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

export default function OrderEntryForm({
  orderId,
  products,
  existingEntry,
}: {
  orderId: string;
  products: ProductOption[];
  existingEntry: ExistingEntry | null;
}) {
  const [shipmentMode, setShipmentMode] = useState(existingEntry?.shipmentMode ?? "EMS");
  const [shippingPrice, setShippingPrice] = useState(
    existingEntry?.shippingPrice?.toString?.() ?? "0"
  );
  const [notes, setNotes] = useState(existingEntry?.notes ?? "");

  const initialRows: Row[] = useMemo(() => {
    if (existingEntry?.items?.length) {
      // existingEntry stores productName (not productId) so we best-effort map by name
      return existingEntry.items.map((it) => {
        const match = products.find((p) => p.name === it.productName);
        return {
          productId: match?.id ?? "",
          quantity: String(it.quantity ?? ""),
          sellingPrice: it.sellingPrice?.toString?.() ?? "",
        };
      });
    }
    return [{ productId: "", quantity: "", sellingPrice: "" }];
  }, [existingEntry, products]);

  const [rows, setRows] = useState<Row[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function addRow() {
    setRows((r) => [...r, { productId: "", quantity: "", sellingPrice: "" }]);
  }

  function removeRow(idx: number) {
    setRows((r) => r.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  async function submit() {
    setLoading(true);
    setErr(null);
    setOk(null);

    const items = rows
      .filter((r) => r.productId && r.quantity && r.sellingPrice)
      .map((r) => ({
        productId: r.productId,
        quantity: Number(r.quantity),
        sellingPrice: r.sellingPrice, // keep string; API will store Decimal
      }));

    const res = await fetch("/api/order-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        shipmentMode,
        shippingPrice,
        notes,
        items,
      }),
    });

    const data = await res.json();
    if (!res.ok) setErr(data?.error || "Failed to save order entry");
    else setOk("Saved successfully");

    setLoading(false);
  }

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-slate-400">Shipment Mode</label>
          <select
            value={shipmentMode}
            onChange={(e) => setShipmentMode(e.target.value)}
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
            onChange={(e) => setShippingPrice(e.target.value)}
            inputMode="decimal"
            className="w-full mt-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
            placeholder="0"
          />
        </div>

        <div className="md:col-span-3">
          <label className="text-xs text-slate-400">Notes</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
                  onChange={(e) => updateRow(idx, { productId: e.target.value })}
                  className="w-full mt-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs text-slate-400">Qty</label>
                <input
                  value={r.quantity}
                  onChange={(e) => updateRow(idx, { quantity: e.target.value })}
                  inputMode="numeric"
                  className="w-full mt-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="1"
                />
              </div>

              <div className="md:col-span-3">
                <label className="text-xs text-slate-400">Selling Price</label>
                <input
                  value={r.sellingPrice}
                  onChange={(e) => updateRow(idx, { sellingPrice: e.target.value })}
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
        {ok && <p className="text-sm text-green-400">{ok}</p>}
      </div>
    </div>
  );
}
