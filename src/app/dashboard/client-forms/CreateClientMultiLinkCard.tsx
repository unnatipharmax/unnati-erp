"use client";

import { useState } from "react";

export default function CreateClientMultiLinkCard() {
  const [loading, setLoading]               = useState(false);
  const [name, setName]                     = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [err, setErr]                       = useState<string | null>(null);
  const [result, setResult]                 = useState<{
    url:        string;
    accountId:  string;
    balance:    string;
    downloadUrl: string;
  } | null>(null);

  async function onCreate() {
    if (!name.trim()) { setErr("Client name is required"); return; }
    if (!openingBalance || isNaN(Number(openingBalance)) || Number(openingBalance) <= 0) {
      setErr("Enter a valid opening balance"); return;
    }

    setLoading(true);
    setErr(null);
    setResult(null);

    const res  = await fetch("/api/client-account-links", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name, openingBalance }),
    });

    const data = await res.json();

    if (!res.ok) {
      setErr(data?.error || "Failed to create link");
    } else {
      setResult({
        url:         data.url,
        accountId:   data.accountId,
        balance:     data.balance,
        downloadUrl: data.downloadUrl,
      });
      setName("");
      setOpeningBalance("");
    }

    setLoading(false);
  }

  function copyLink() {
    if (result?.url) navigator.clipboard.writeText(result.url);
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border">
      <h2 className="text-lg font-semibold text-slate-900">Create Multi Order Link</h2>
      <p className="text-sm text-slate-500 mt-1">
        Permanent link for advance clients — orders deduct from prepaid balance.
        An Excel ledger is auto-generated on creation.
      </p>

      {/* Form */}
      {!result ? (
        <div className="mt-4 space-y-3">
          <input
            placeholder="Client Name (e.g. ABC Distributors)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            placeholder="Opening Balance (e.g. 50000)"
            inputMode="decimal"
            value={openingBalance}
            onChange={e => setOpeningBalance(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={onCreate}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60 transition"
            >
              {loading ? "Creating…" : "Create Multi Link"}
            </button>
            {err && <span className="text-sm text-red-600">{err}</span>}
          </div>
        </div>
      ) : (
        /* ── Result card ── */
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
          {/* Success badge */}
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-lg">✅</span>
            <span className="font-semibold text-slate-800">Link created successfully!</span>
          </div>

          {/* Balance */}
          <div className="text-sm text-slate-600">
            Opening Balance:{" "}
            <span className="font-bold text-green-700">
              ₹{Number(result.balance).toLocaleString("en-IN")}
            </span>
          </div>

          {/* Order URL */}
          <div>
            <p className="text-xs text-slate-500 mb-1">Client Order URL (share this link)</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={result.url}
                onClick={e => (e.target as HTMLInputElement).select()}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono outline-none"
              />
              <button
                onClick={copyLink}
                className="shrink-0 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Download Excel */}
          <a
            href={result.downloadUrl}
            download
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 transition"
          >
            <span>📥</span>
            Download Client Excel Ledger
          </a>

          <p className="text-xs text-slate-400 text-center">
            Re-download anytime — the file always reflects the latest orders from the database.
          </p>

          {/* Create another */}
          <button
            onClick={() => setResult(null)}
            className="w-full rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm py-2 transition"
          >
            + Create Another Link
          </button>
        </div>
      )}
    </div>
  );
}