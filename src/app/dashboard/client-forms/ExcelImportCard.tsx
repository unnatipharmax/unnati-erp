"use client";

import { useEffect, useRef, useState } from "react";

type Account = { id: string; name: string; balance: string; token: string | null };

type ImportResult = {
  created: number;
  total: number;
  errors: { row: number; error: string }[];
};

export default function ExcelImportCard() {
  const [accounts,    setAccounts]    = useState<Account[]>([]);
  const [accountId,   setAccountId]   = useState("");
  const [file,        setFile]        = useState<File | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState<ImportResult | null>(null);
  const [err,         setErr]         = useState<string | null>(null);
  const [accsLoading, setAccsLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/client-accounts")
      .then(r => r.json())
      .then(d => { setAccounts(d.accounts ?? []); setAccsLoading(false); });
  }, []);

  function reset() {
    setFile(null); setResult(null); setErr(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onImport() {
    if (!accountId) { setErr("Select a client account"); return; }
    if (!file)      { setErr("Upload an Excel file"); return; }

    setLoading(true); setErr(null); setResult(null);

    const form = new FormData();
    form.set("file", file);

    const res  = await fetch(`/api/client-accounts/${accountId}/import-orders`, {
      method: "POST", body: form,
    });
    const data = await res.json();

    if (!res.ok) { setErr(data?.error || "Import failed"); }
    else         { setResult(data); }

    setLoading(false);
  }

  const selected = accounts.find(a => a.id === accountId);

  return (
    <div className="card" style={{ gridColumn: "1 / -1" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.25rem" }}>
        <h2 style={{ margin: 0 }}>Import Orders from Excel</h2>
        <a
          href="/api/client-accounts/template"
          download
          className="btn btn-secondary btn-sm"
          style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.35rem" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Download Template
        </a>
      </div>
      <p style={{ fontSize: "0.8125rem", marginBottom: "1.25rem", color: "var(--text-muted)" }}>
        Upload a client Excel sheet to bulk-create orders under an existing account.
      </p>

      {result ? (
        /* ── Results panel ── */
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <div className={result.errors.length === 0 ? "alert alert-success" : "alert alert-warning"}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.1rem" }}>{result.errors.length === 0 ? "✅" : "⚠️"}</span>
            <span>
              <strong>{result.created}</strong> of <strong>{result.total}</strong> orders imported successfully
              {result.errors.length > 0 && <>, <strong>{result.errors.length}</strong> failed</>}.
            </span>
          </div>

          {result.errors.length > 0 && (
            <div style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "0.75rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f87171", marginBottom: "0.5rem", textTransform: "uppercase" }}>
                Row Errors
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {result.errors.map(e => (
                  <div key={e.row} style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                    Row {e.row}: {e.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button onClick={reset} className="btn btn-secondary">Import Another File</button>
          </div>
        </div>
      ) : (
        /* ── Upload form ── */
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {/* Account selector */}
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              Client Account *
            </label>
            {accsLoading ? (
              <div className="skeleton" style={{ height: 38, borderRadius: 8 }} />
            ) : (
              <select
                value={accountId}
                onChange={e => { setAccountId(e.target.value); setErr(null); }}
                style={{ width: "100%", fontSize: "0.875rem", padding: "0.5rem 0.6rem" }}
              >
                <option value="">— Select account —</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} · ₹{Number(a.balance).toLocaleString("en-IN")}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Current balance hint */}
          {selected && (
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span>Account:</span>
              <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{selected.name}</span>
              <span>·</span>
              <span>Balance: <strong style={{ color: Number(selected.balance) > 0 ? "#4ade80" : "#f87171" }}>
                ₹{Number(selected.balance).toLocaleString("en-IN")}
              </strong></span>
            </div>
          )}

          {/* File picker */}
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              Excel File (.xlsx) *
            </label>
            <div style={{
              border: "2px dashed var(--border)", borderRadius: 10,
              padding: "1.25rem", textAlign: "center",
              background: file ? "rgba(74,222,128,0.04)" : "var(--surface-2)",
              cursor: "pointer",
              transition: "border-color 0.15s",
            }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setFile(f); setErr(null); } }}
            >
              {file ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "1.25rem" }}>📊</span>
                  <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{file.name}</span>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1rem", lineHeight: 1 }}
                  >✕</button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.35rem", opacity: 0.4 }}>📂</div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                    Click or drag & drop an Excel file here
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                    .xlsx files only · Columns: Full Name, Email, Phone, Address, City, State, Postal Code, Country + optional fields
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setErr(null); } }}
            />
          </div>

          {/* Required columns hint */}
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", background: "var(--surface-2)", borderRadius: 8, padding: "0.5rem 0.75rem" }}>
            <strong>Required columns:</strong> Full Name, Email, Phone, Address, City, State, Postal Code, Country &nbsp;·&nbsp;
            <strong>Optional:</strong> Amount Paid, Currency, Remitter Name, License No
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              onClick={onImport}
              disabled={loading || !accountId || !file}
              className="btn btn-primary"
            >
              {loading ? "Importing…" : "Import Orders"}
            </button>
            {err && (
              <div className="alert alert-error" style={{ padding: "0.375rem 0.75rem", fontSize: "0.8rem" }}>{err}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
