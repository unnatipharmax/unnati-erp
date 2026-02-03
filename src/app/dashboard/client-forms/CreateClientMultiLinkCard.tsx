"use client";

import { useState } from "react";

export default function CreateClientMultiLinkCard() {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onCreate() {
    setLoading(true);
    setErr(null);
    setUrl(null);

    const res = await fetch("/api/client-account-links", { method: "POST" });
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
      <h2 className="text-lg font-semibold text-slate-900">Create Multi Order Link</h2>
      <p className="text-sm text-slate-600 mt-1">
        Permanent link for advance clients. They can submit multiple orders until balance becomes 0.
      </p>

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

      {url && (
        <div className="mt-4 p-3 rounded-lg bg-slate-50 border">
          <div className="text-sm font-semibold text-slate-800">Multi Order Link</div>
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
