"use client";
import { useEffect, useState } from "react";

// ── Parsed order shape ───────────────────────────────────────────────────────
type Parsed = {
  fullName: string; email: string; phone: string;
  address: string; city: string; state: string; postalCode: string; country: string;
  remitterName: string; amountPaid: string; currency: string;
};

const EMPTY: Parsed = {
  fullName: "", email: "", phone: "", address: "", city: "", state: "",
  postalCode: "", country: "", remitterName: "", amountPaid: "", currency: "",
};

// Field → accepted label aliases (lowercased, punctuation-stripped).
const FIELD_ALIASES: Record<keyof Parsed, string[]> = {
  fullName:     ["name", "full name", "customer", "customer name", "client name"],
  email:        ["email", "email id", "e-mail", "mail"],
  phone:        ["phone", "mobile", "contact", "phone no", "mobile no", "number", "whatsapp"],
  address:      ["address", "addr", "add", "street", "address line", "add1"],
  city:         ["city", "town"],
  state:        ["state", "province", "region"],
  postalCode:   ["postal code", "postalcode", "pincode", "pin code", "pin", "zip", "zipcode", "zip code", "postcode"],
  country:      ["country", "nation"],
  remitterName: ["remitter", "remitter name", "sender", "payer", "paid by"],
  amountPaid:   ["amount", "amount paid", "paid", "value", "order value", "total", "amt"],
  currency:     ["currency", "curr", "cur"],
};

const TEMPLATE = `Name:
Email:
Phone:
Address:
City:
State:
Postal Code:
Country:
Amount:
Currency: USD
Remitter: `;

// Parse a labeled multi-line message into order fields. Order-independent.
function parseMessage(text: string): Parsed {
  const out: Parsed = { ...EMPTY };
  const lines = text.split(/\r?\n/);
  // Build a lookup: alias → field key
  const aliasToField: Record<string, keyof Parsed> = {};
  (Object.keys(FIELD_ALIASES) as (keyof Parsed)[]).forEach(f =>
    FIELD_ALIASES[f].forEach(a => { aliasToField[a] = f; })
  );

  for (const raw of lines) {
    const idx = raw.indexOf(":");
    if (idx < 0) continue;
    const label = raw.slice(0, idx).trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
    const value = raw.slice(idx + 1).trim();
    if (!value) continue;
    const field = aliasToField[label];
    if (field && !out[field]) out[field] = value;
  }
  // normalize currency
  if (out.currency) out.currency = out.currency.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
  // strip currency symbols from amount
  if (out.amountPaid) out.amountPaid = out.amountPaid.replace(/[,\s₹$€£]/g, "");
  return out;
}

type Account = { id: string; name: string; balance: string };

export default function QuickOrderPasteCard() {
  const [tab, setTab] = useState<"single" | "multi">("single");
  const [text, setText] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<{ orderId: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/client-accounts").then(r => r.json()).then(d => {
      setAccounts(Array.isArray(d) ? d : (d.accounts ?? []));
    }).catch(() => {});
  }, []);

  const parsed = parseMessage(text);
  const hasName = !!parsed.fullName.trim();

  function copyTemplate() {
    navigator.clipboard.writeText(TEMPLATE);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function save() {
    setErr(null); setOk(null);
    if (!hasName) { setErr("Could not read a customer name. Check the format."); return; }
    if (tab === "multi" && !accountId) { setErr("Select a client account for the multi order."); return; }
    setSaving(true);
    try {
      const url = tab === "single" ? "/api/client-quick-order/single" : "/api/client-quick-order/multi";
      const body = tab === "single" ? parsed : { ...parsed, accountId };
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data?.error || "Failed to create order"); return; }
      setOk({ orderId: data.orderId });
      setText("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  const shortId = ok ? ok.orderId.split("-")[0].toUpperCase() : "";

  const previewRows: { label: string; key: keyof Parsed }[] = [
    { label: "Name", key: "fullName" }, { label: "Email", key: "email" }, { label: "Phone", key: "phone" },
    { label: "Address", key: "address" }, { label: "City", key: "city" }, { label: "State", key: "state" },
    { label: "Postal Code", key: "postalCode" }, { label: "Country", key: "country" },
    { label: "Amount", key: "amountPaid" }, { label: "Currency", key: "currency" }, { label: "Remitter", key: "remitterName" },
  ];

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Quick Order (Paste Message)</h2>
          <p style={{ fontSize: "0.8125rem", marginTop: 4, color: "var(--text-secondary)" }}>
            Paste a WhatsApp/message order in the format below — it auto-fills and creates the order.
          </p>
        </div>
        <button onClick={copyTemplate} className="btn btn-secondary btn-sm">
          {copied ? "✓ Copied" : "📋 Copy Template"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", margin: "1rem 0", borderBottom: "1px solid var(--border)", paddingBottom: "0.6rem" }}>
        {(["single", "multi"] as const).map(t => (
          <button key={t}
            onClick={() => { setTab(t); setErr(null); setOk(null); }}
            className={`btn btn-sm ${tab === t ? "btn-primary" : "btn-secondary"}`}>
            {t === "single" ? "🔗 Single Client Order" : "🏢 Multi Client Order"}
          </button>
        ))}
      </div>

      {/* Multi: account picker */}
      {tab === "multi" && (
        <div style={{ marginBottom: "0.875rem" }}>
          <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Client Account *</label>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} style={{ width: "100%" }}>
            <option value="">— Select account —</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} · ${Number(a.balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </option>
            ))}
          </select>
        </div>
      )}

      {ok && (
        <div className="alert alert-success" style={{ marginBottom: "0.875rem", flexDirection: "column", alignItems: "flex-start" }}>
          <div style={{ fontWeight: 700 }}>✅ Order created — #{shortId}</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2, wordBreak: "break-all" }}>Internal ID: {ok.orderId}</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="qop-grid">
        {/* Paste box */}
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Paste order message *</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={TEMPLATE}
            rows={12}
            style={{ width: "100%", fontFamily: "monospace", fontSize: "0.8rem", lineHeight: 1.5, resize: "vertical", boxSizing: "border-box" }}
          />
        </div>

        {/* Live preview */}
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Parsed preview</label>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "0.5rem 0.75rem", background: "var(--surface-1)", minHeight: 200 }}>
            {previewRows.map(r => {
              const val = parsed[r.key];
              const required = r.key === "fullName";
              return (
                <div key={r.key} style={{ display: "flex", gap: 8, padding: "3px 0", fontSize: "0.8rem", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ width: 92, color: "var(--text-muted)", flexShrink: 0 }}>{r.label}</span>
                  <span style={{ fontWeight: val ? 600 : 400, color: val ? "var(--text-primary)" : (required ? "#dc2626" : "var(--text-muted)") }}>
                    {val || (required ? "⚠ missing" : "—")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
        <button onClick={save} disabled={saving || !hasName} className="btn btn-primary">
          {saving ? "Saving…" : "💾 Save & Create Order"}
        </button>
        {err && <span style={{ fontSize: "0.82rem", color: "#dc2626" }}>{err}</span>}
        {!parsed.currency && hasName && <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>No currency found — will default to USD.</span>}
      </div>

      <style>{`@media (max-width: 720px) { .qop-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
