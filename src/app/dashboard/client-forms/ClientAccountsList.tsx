"use client";

import { useEffect, useState } from "react";

const PAGE_SIZE = 6;

type Account = { id: string; name: string; balance: string; createdAt: string; token: string | null; };

export default function ClientAccountsList() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading]   = useState(true);
  const [copied, setCopied]     = useState<string | null>(null);
  const [page, setPage]         = useState(1);

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

  const totalPages  = Math.ceil(accounts.length / PAGE_SIZE);
  const paged       = accounts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);

  return (
    <div style={{ marginTop: "2rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0 }}>All Multi-Order Accounts</h2>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          {accounts.length} account{accounts.length !== 1 ? "s" : ""}
        </span>
      </div>

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
            {paged.map(acc => (
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", marginTop: "1rem" }}>
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 1}
            style={{
              padding: "0.25rem 0.625rem", borderRadius: 6, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text-muted)", cursor: page === 1 ? "not-allowed" : "pointer",
              opacity: page === 1 ? 0.35 : 1, fontSize: "0.8rem",
            }}
          >
            ←
          </button>

          {pages.map((p, i) =>
            p === "…" ? (
              <span key={`e-${i}`} style={{ padding: "0 0.25rem", color: "var(--text-muted)", fontSize: "0.8rem" }}>…</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p as number)}
                style={{
                  padding: "0.25rem 0.625rem", borderRadius: 6, fontSize: "0.8rem", fontWeight: 500,
                  border: p === page ? "none" : "1px solid var(--border)",
                  background: p === page ? "var(--text-secondary)" : "transparent",
                  color: p === page ? "#fff" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page === totalPages}
            style={{
              padding: "0.25rem 0.625rem", borderRadius: 6, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text-muted)", cursor: page === totalPages ? "not-allowed" : "pointer",
              opacity: page === totalPages ? 0.35 : 1, fontSize: "0.8rem",
            }}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
