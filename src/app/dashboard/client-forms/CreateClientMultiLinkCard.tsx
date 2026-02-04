"use client";

import { useState } from "react";

export default function CreateClientMultiLinkCard() {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");

  async function onCreate() {
    if (!name.trim()) {
      setErr("Client name is required");
      return;
    }

    setLoading(true);
    setErr(null);
    setUrl(null);

    const res = await fetch("/api/client-account-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        openingBalance,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setErr(data?.error || "Failed to create multi order link");
    } else {
      setUrl(data.url);
    }

    setLoading(false);
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border">
      <h2 className="text-lg font-semibold text-slate-900">
        Create Multi Order Link
      </h2>

      <p className="text-sm text-slate-600 mt-1">
        Permanent link for advance clients. Orders allowed until balance becomes 0.
      </p>

      {/* Inputs */}
      <div className="mt-4 space-y-3">
        <input
          placeholder="Client Name (e.g. ABC Distributors)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />

        <input
          placeholder="Opening Balance (e.g. 50000)"
          inputMode="decimal"
          value={openingBalance}
          onChange={(e) => setOpeningBalance(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      {/* Action */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={onCreate}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create Multi Link"}
        </button>

        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>

      {/* Result */}
      {url && (
        <div className="mt-4 p-3 rounded-lg bg-slate-50 border">
          <div className="text-sm font-semibold text-slate-800">
            Multi Order Link
          </div>
          <div className="text-xs text-slate-600 break-all mt-1">{url}</div>

          <button
            className="mt-3 text-sm text-blue-700 font-semibold"
            onClick={() => navigator.clipboard.writeText(url)}
          >
            Copy Link
          </button>
        </div>
      )}
    </div>
  );
}
