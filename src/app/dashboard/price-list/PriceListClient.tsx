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

export default function PriceListClient() {
  const [items, setItems]       = useState<PriceItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL");

  useEffect(() => {
    fetch("/api/price-list")
      .then(r => r.json())
      .then(data => { setItems(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Price List</h1>
          <p className="text-sm text-slate-400 mt-1">
            Selling price range for each product. Do not share MRP with clients.
          </p>
        </div>
        <div className="text-xs text-slate-500 bg-slate-800/50 border border-slate-700/60 rounded-xl px-3 py-2 self-center">
          {filtered.length} of {items.length} products
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, composition, manufacturer…"
          className="flex-1 min-w-[220px] rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-500"
        />
        {groups.length > 2 && (
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
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
        <div className="rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/70 text-slate-400 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-medium w-8">#</th>
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Pack</th>
                <th className="px-4 py-3 text-right font-medium">Min Price (₹)</th>
                <th className="px-4 py-3 text-right font-medium">Max Price (₹)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => (
                <tr
                  key={item.id}
                  className="border-t border-slate-800/60 hover:bg-slate-800/30 transition-colors duration-100"
                >
                  <td className="px-4 py-3 text-slate-600 tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-100 leading-snug">{item.name}</div>
                    {item.composition && (
                      <div className="text-xs text-slate-500 mt-0.5">{item.composition}</div>
                    )}
                    {item.manufacturer && (
                      <div className="text-xs text-slate-600 mt-0.5">{item.manufacturer}</div>
                    )}
                    {item.group && (
                      <span className="inline-block mt-1 text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-md px-1.5 py-0.5">
                        {item.group}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                    {item.pack ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.minPrice != null ? (
                      <span className="font-semibold text-emerald-400 tabular-nums">
                        ₹{fmt(item.minPrice)}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.maxPrice != null ? (
                      <span className="font-semibold text-blue-400 tabular-nums">
                        ₹{fmt(item.maxPrice)}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
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
    </div>
  );
}
