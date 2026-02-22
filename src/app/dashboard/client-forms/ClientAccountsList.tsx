"use client";

import { useEffect, useState } from "react";

type Account = { id: string; name: string; balance: string; createdAt: string; token: string | null; };

export default function ClientAccountsList() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading]   = useState(true);
  const [copied, setCopied]     = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/client-accounts").then(r => r.json())
      .then(d => { setAccounts(d.accounts ?? []); setLoading(false); });
  }, []);

  function copyLink(token: string) {
    const url = `${window.location.origin}/client-multi-form/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token); setTimeout(() => setCopied(null), 2000);
  }

  if (loading) return (
    <div style={{ marginTop: "2rem" }}>
      <h2 style={{ marginBottom: "1rem" }}>All Multi-Order Accounts</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {[1,2,3].map(i => (
          <div key={i} className="skeleton" style={{ height: 48, borderRadius: 12 }} />
        ))}
      </div>
    </div>
  );

  if (!accounts.length) return (
    <div style={{ marginTop: "2rem" }}>
      <h2 style={{ marginBottom: "0.5rem" }}>All Multi-Order Accounts</h2>
      <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
        No accounts yet. Create one above.
      </div>
    </div>
  );

  return (
    <div style={{ marginTop: "2rem" }}>
      <h2 style={{ marginBottom: "1rem" }}>All Multi-Order Accounts</h2>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Client Name</th>
              <th>Balance (₹)</th>
              <th>Created</th>
              <th>Order Link</th>
              <th>Excel Ledger</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(acc => (
              <tr key={acc.id}>
                <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{acc.name}</td>
                <td>
                  <span className="badge badge-green">
                    ₹{Number(acc.balance).toLocaleString("en-IN")}
                  </span>
                </td>
                <td style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                  {new Date(acc.createdAt).toLocaleDateString("en-IN")}
                </td>
                <td>
                  {acc.token ? (
                    <button onClick={() => copyLink(acc.token!)} className="btn-copy">
                      {copied === acc.token ? "✓ Copied" : "Copy Link"}
                    </button>
                  ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                </td>
                <td>
                  <a href={`/api/client-account-links/download/${acc.id}`} download className="btn-download">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Download
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