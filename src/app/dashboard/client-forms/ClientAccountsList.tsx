// src/app/dashboard/client-forms/ClientAccountsList.tsx
// Shows all created multi-order accounts with their download button
"use client";

import { useEffect, useState } from "react";

type Account = {
  id:        string;
  name:      string;
  balance:   string;
  createdAt: string;
  token:     string | null;
};

export default function ClientAccountsList() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch("/api/client-accounts")
      .then(r => r.json())
      .then(d => { setAccounts(d.accounts ?? []); setLoading(false); });
  }, []);

  if (loading) return <p className="text-sm text-slate-500 mt-6">Loading accounts...</p>;
  if (!accounts.length) return <p className="text-sm text-slate-500 mt-6">No multi-order accounts yet.</p>;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-slate-800 mb-3">All Multi-Order Accounts</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-slate-600">
              <th className="px-4 py-3 font-medium">Client Name</th>
              <th className="px-4 py-3 font-medium">Balance (₹)</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Order Link</th>
              <th className="px-4 py-3 font-medium">Excel Ledger</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc, i) => (
              <tr key={acc.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                <td className="px-4 py-3 font-medium text-slate-800">{acc.name}</td>
                <td className="px-4 py-3 text-emerald-700 font-semibold">
                  ₹{Number(acc.balance).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(acc.createdAt).toLocaleDateString("en-IN")}
                </td>
                <td className="px-4 py-3">
                  {acc.token ? (
                    <button
                      onClick={() => navigator.clipboard.writeText(`${baseUrl}/client-multi-form/${acc.token}`)}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Copy Link
                    </button>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`/api/client-account-links/download/${acc.id}`}
                    download
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
                  >
                    📥 Download
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}