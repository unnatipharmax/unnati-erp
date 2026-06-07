"use client";

import { useMemo, useState } from "react";

type Row = {
  id: string;
  date: string;        // ISO
  invoiceNo: string;
  trackingNo: string;
  party: string;
  center: string;
  weight: number | null; // kg
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB"); // DD/MM/YYYY
}
function money(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CourierBillClient({ rows }: { rows: Row[] }) {
  const [pricePerKg, setPricePerKg] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo]     = useState("");
  const [search, setSearch] = useState("");

  const rate = parseFloat(pricePerKg) || 0;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (from && r.date.slice(0, 10) < from) return false;
      if (to && r.date.slice(0, 10) > to) return false;
      if (q && !(
        r.party.toLowerCase().includes(q) ||
        r.trackingNo.toLowerCase().includes(q) ||
        r.invoiceNo.toLowerCase().includes(q) ||
        r.center.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [rows, from, to, search]);

  const totalWeight = filtered.reduce((s, r) => s + (r.weight ?? 0), 0);
  const totalAmount = filtered.reduce((s, r) => s + (r.weight ?? 0) * rate, 0);

  function downloadCSV() {
    const header = ["Date", "Doc No", "Tracking No", "Party Name", "Center", "Weight (kg)", "Amount"];
    const lines = filtered.map((r) => {
      const amt = (r.weight ?? 0) * rate;
      return [
        fmtDate(r.date),
        r.invoiceNo,
        r.trackingNo,
        r.party,
        r.center,
        (r.weight ?? 0).toFixed(2),
        amt.toFixed(2),
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
    });
    // Totals row
    lines.push(["", "", "", "", "TOTAL", totalWeight.toFixed(2), totalAmount.toFixed(2)]
      .map((c) => `"${c}"`).join(","));

    const csv = [header.map((h) => `"${h}"`).join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `courier-bill-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Courier Bill</h1>
          <p className="text-sm text-slate-500 mt-1">
            Dispatched orders with weight. Set a price per kg to calculate the courier amount.
          </p>
        </div>
        <button onClick={downloadCSV} className="btn btn-primary btn-sm">⬇ Download Sheet</button>
      </div>

      {/* Controls */}
      <div className="flex gap-3 flex-wrap mb-4 items-end">
        <label className="block">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Price per kg (₹)</span>
          <input
            type="number" value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value)}
            placeholder="e.g. 40" min="0" step="0.01"
            className="mt-1 w-36 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="mt-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="mt-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500" />
        </label>
        <label className="block flex-1 min-w-[200px]">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Party, tracking, invoice, center…"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
        </label>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-500 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium w-10">#</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Doc No</th>
              <th className="px-4 py-3 text-left font-medium">Tracking No</th>
              <th className="px-4 py-3 text-left font-medium">Party Name</th>
              <th className="px-4 py-3 text-left font-medium">Center</th>
              <th className="px-4 py-3 text-right font-medium">Weight (kg)</th>
              <th className="px-4 py-3 text-right font-medium">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No dispatched orders found.</td></tr>
            ) : filtered.map((r, idx) => {
              const amt = (r.weight ?? 0) * rate;
              return (
                <tr key={r.id} className="border-t border-slate-200 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-slate-400 tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">{r.invoiceNo || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">{r.trackingNo || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-900 font-medium">{r.party}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.center || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                    {r.weight != null ? r.weight.toFixed(2) : <span className="text-red-600">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                    {r.weight != null && rate > 0 ? `₹${money(amt)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                <td className="px-4 py-3" colSpan={6}>TOTAL · {filtered.length} parcels</td>
                <td className="px-4 py-3 text-right tabular-nums">{totalWeight.toFixed(2)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{rate > 0 ? `₹${money(totalAmount)}` : "—"}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
