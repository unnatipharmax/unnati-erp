"use client";

import { useState } from "react";

export default function CreateClientLinkCard() {
  const [loading, setLoading] = useState(false);
  const [link, setLink]       = useState<string | null>(null);
  const [err, setErr]         = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);

  async function createLink() {
    setLoading(true); setErr(null); setLink(null);
    const res  = await fetch("/api/client-form-links", { method: "POST" });
    const data = await res.json();
    if (!res.ok) setErr(data?.error || "Failed to create link");
    else setLink(`${window.location.origin}/client-form/${data.token}`);
    setLoading(false);
  }

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: "0.25rem" }}>Create Client Order Form Link</h2>
      <p style={{ fontSize: "0.8125rem", marginBottom: "1.25rem" }}>
        Generate a secure one-time link for clients to submit order details.
      </p>

      <button onClick={createLink} disabled={loading} className="btn btn-primary">
        {loading ? (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="animate-spin">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            Creating…
          </>
        ) : "Create Link"}
      </button>

      {err && (
        <div className="alert alert-error" style={{ marginTop: "0.75rem" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
          </svg>
          {err}
        </div>
      )}

      {link && (
        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div className="alert alert-success">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Link created successfully!
          </div>

          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Client Link — click to select, then copy
          </p>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              readOnly value={link}
              onClick={e => (e.target as HTMLInputElement).select()}
              style={{ fontFamily: "monospace", fontSize: "0.75rem" }}
            />
            <button onClick={copyLink} className="btn btn-secondary btn-sm" style={{ whiteSpace: "nowrap" }}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>

          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            This is a one-time link — share it with the client directly.
          </p>
        </div>
      )}
    </div>
  );
}