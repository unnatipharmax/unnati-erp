"use client";

import { useState } from "react";

export default function CreateClientMultiLinkCard() {
  const [loading, setLoading]             = useState(false);
  const [name, setName]                   = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [err, setErr]                     = useState<string | null>(null);
  const [copied, setCopied]               = useState(false);
  const [result, setResult]               = useState<{
    url: string; accountId: string; balance: string; downloadUrl: string;
  } | null>(null);

  async function onCreate() {
    if (!name.trim()) { setErr("Client name is required"); return; }
    if (!openingBalance || isNaN(Number(openingBalance)) || Number(openingBalance) <= 0) {
      setErr("Enter a valid opening balance"); return;
    }
    setLoading(true); setErr(null); setResult(null);
    const res  = await fetch("/api/client-account-links", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, openingBalance }),
    });
    const data = await res.json();
    if (!res.ok) setErr(data?.error || "Failed to create link");
    else { setResult({ url: data.url, accountId: data.accountId, balance: data.balance, downloadUrl: data.downloadUrl }); setName(""); setOpeningBalance(""); }
    setLoading(false);
  }

  function copyLink() {
    if (!result?.url) return;
    navigator.clipboard.writeText(result.url);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: "0.25rem" }}>Create Multi Order Link</h2>
      <p style={{ fontSize: "0.8125rem", marginBottom: "1.25rem" }}>
        Permanent link for advance clients — orders deduct from prepaid balance.
      </p>

      {!result ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <input placeholder="Client Name (e.g. ABC Distributors)" value={name}
            onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && onCreate()} />
          <input placeholder="Opening Balance (e.g. 50000)" inputMode="decimal" value={openingBalance}
            onChange={e => setOpeningBalance(e.target.value)} onKeyDown={e => e.key === "Enter" && onCreate()} />

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button onClick={onCreate} disabled={loading} className="btn btn-primary">
              {loading ? "Creating…" : "Create Multi Link"}
            </button>
            {err && <div className="alert alert-error" style={{ padding: "0.375rem 0.75rem", fontSize: "0.8rem" }}>{err}</div>}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <div className="alert alert-success">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Link created! Opening balance: <strong>₹{Number(result.balance).toLocaleString("en-IN")}</strong>
          </div>

          <div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.375rem" }}>Client Order URL</p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input readOnly value={result.url} onClick={e => (e.target as HTMLInputElement).select()}
                style={{ fontFamily: "monospace", fontSize: "0.75rem" }} />
              <button onClick={copyLink} className="btn btn-secondary btn-sm" style={{ whiteSpace: "nowrap" }}>
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>

          <a href={result.downloadUrl} download className="btn-download" style={{ justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Download Client Excel Ledger
          </a>

          <button onClick={() => setResult(null)} className="btn btn-secondary">+ Create Another Link</button>
        </div>
      )}
    </div>
  );
}