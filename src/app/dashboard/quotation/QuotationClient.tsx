"use client";
import { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type LineItem = {
  id: number;
  description: string;
  quantity: number;
  rate: number;
};

type QuotationData = {
  logoUrl: string | null;
  fromName: string;
  fromAddress: string;
  fromEmail: string;
  fromPhone: string;
  toName: string;
  toAddress: string;
  toEmail: string;
  quoteNo: string;
  quoteDate: string;
  validUntil: string;
  currency: string;
  taxLabel: string;
  taxPercent: number;
  items: LineItem[];
  notes: string;
  terms: string;
};

const CURRENCIES = ["USD", "INR", "EUR", "GBP", "AUD", "CAD", "AED"];

function today() {
  return new Date().toISOString().split("T")[0];
}
function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n) + " " + currency;
}

let nextId = 1;
function newItem(): LineItem {
  return { id: nextId++, description: "", quantity: 1, rate: 0 };
}

// ── Print / PDF ───────────────────────────────────────────────────────────────
function printQuotation() {
  window.print();
}

// ── Preview component ─────────────────────────────────────────────────────────
function QuotationPreview({ q }: { q: QuotationData }) {
  const subtotal = q.items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const taxAmt = subtotal * (q.taxPercent / 100);
  const total = subtotal + taxAmt;

  const td: React.CSSProperties = {
    border: "1px solid #ddd",
    padding: "7px 10px",
    fontSize: "9pt",
    verticalAlign: "top",
  };
  const th: React.CSSProperties = {
    ...td,
    background: "#1a3c6e",
    color: "#fff",
    fontWeight: 700,
    textAlign: "left",
  };

  return (
    <div
      id="quotation-preview"
      style={{
        background: "#fff",
        color: "#222",
        fontFamily: "Arial, sans-serif",
        fontSize: "9pt",
        padding: "32px 36px",
        minHeight: 900,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          {q.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={q.logoUrl} alt="logo" style={{ maxHeight: 72, maxWidth: 200, marginBottom: 8 }} />
          ) : (
            <div style={{ width: 120, height: 56, border: "1.5px dashed #bbb", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: "8pt", marginBottom: 8 }}>
              Your Logo
            </div>
          )}
          <div style={{ fontWeight: 700, fontSize: "12pt" }}>{q.fromName || "Your Company"}</div>
          <div style={{ whiteSpace: "pre-line", color: "#555", fontSize: "8.5pt" }}>{q.fromAddress}</div>
          {q.fromEmail && <div style={{ color: "#555", fontSize: "8.5pt" }}>{q.fromEmail}</div>}
          {q.fromPhone && <div style={{ color: "#555", fontSize: "8.5pt" }}>{q.fromPhone}</div>}
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "22pt", fontWeight: 700, color: "#1a3c6e", letterSpacing: 1 }}>QUOTATION</div>
          <table style={{ marginTop: 10, marginLeft: "auto", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ padding: "2px 8px 2px 0", color: "#777", fontSize: "8pt" }}>Quote No.</td>
                <td style={{ padding: "2px 0", fontWeight: 600 }}>{q.quoteNo || "—"}</td>
              </tr>
              <tr>
                <td style={{ padding: "2px 8px 2px 0", color: "#777", fontSize: "8pt" }}>Date</td>
                <td style={{ padding: "2px 0" }}>{q.quoteDate}</td>
              </tr>
              <tr>
                <td style={{ padding: "2px 8px 2px 0", color: "#777", fontSize: "8pt" }}>Valid Until</td>
                <td style={{ padding: "2px 0" }}>{q.validUntil}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill To */}
      <div style={{ marginBottom: 20, background: "#f5f7fb", borderRadius: 6, padding: "10px 14px" }}>
        <div style={{ fontWeight: 700, color: "#1a3c6e", marginBottom: 4, fontSize: "8.5pt", textTransform: "uppercase" }}>Bill To</div>
        <div style={{ fontWeight: 700 }}>{q.toName || "—"}</div>
        <div style={{ whiteSpace: "pre-line", color: "#555", fontSize: "8.5pt" }}>{q.toAddress}</div>
        {q.toEmail && <div style={{ color: "#555", fontSize: "8.5pt" }}>{q.toEmail}</div>}
      </div>

      {/* Items table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <thead>
          <tr>
            <th style={{ ...th, width: "48%" }}>Description</th>
            <th style={{ ...th, width: "14%", textAlign: "right" }}>Qty</th>
            <th style={{ ...th, width: "19%", textAlign: "right" }}>Rate ({q.currency})</th>
            <th style={{ ...th, width: "19%", textAlign: "right" }}>Amount ({q.currency})</th>
          </tr>
        </thead>
        <tbody>
          {q.items.map((item) => (
            <tr key={item.id}>
              <td style={td}>{item.description || <span style={{ color: "#bbb" }}>—</span>}</td>
              <td style={{ ...td, textAlign: "right" }}>{item.quantity}</td>
              <td style={{ ...td, textAlign: "right" }}>{item.rate.toFixed(2)}</td>
              <td style={{ ...td, textAlign: "right" }}>{(item.quantity * item.rate).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <table style={{ borderCollapse: "collapse", minWidth: 260 }}>
          <tbody>
            <tr>
              <td style={{ padding: "4px 16px 4px 0", color: "#555" }}>Subtotal</td>
              <td style={{ padding: "4px 0", textAlign: "right" }}>{fmt(subtotal, q.currency)}</td>
            </tr>
            {q.taxPercent > 0 && (
              <tr>
                <td style={{ padding: "4px 16px 4px 0", color: "#555" }}>
                  {q.taxLabel || "Tax"} ({q.taxPercent}%)
                </td>
                <td style={{ padding: "4px 0", textAlign: "right" }}>{fmt(taxAmt, q.currency)}</td>
              </tr>
            )}
            <tr>
              <td
                colSpan={2}
                style={{ borderTop: "2px solid #1a3c6e", padding: "8px 0 0" }}
              />
            </tr>
            <tr>
              <td style={{ padding: "4px 16px 4px 0", fontWeight: 700, fontSize: "11pt", color: "#1a3c6e" }}>
                Total
              </td>
              <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 700, fontSize: "11pt", color: "#1a3c6e" }}>
                {fmt(total, q.currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Notes / Terms */}
      {(q.notes || q.terms) && (
        <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
          {q.notes && (
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, marginBottom: 4, color: "#1a3c6e", fontSize: "8.5pt" }}>NOTES</div>
              <div style={{ whiteSpace: "pre-line", color: "#555", fontSize: "8.5pt" }}>{q.notes}</div>
            </div>
          )}
          {q.terms && (
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, marginBottom: 4, color: "#1a3c6e", fontSize: "8.5pt" }}>TERMS & CONDITIONS</div>
              <div style={{ whiteSpace: "pre-line", color: "#555", fontSize: "8.5pt" }}>{q.terms}</div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 40, borderTop: "1px solid #eee", paddingTop: 10, textAlign: "center", color: "#aaa", fontSize: "7.5pt" }}>
        This is a computer-generated quotation. Thank you for your business.
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function QuotationClient() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState<QuotationData>({
    logoUrl: null,
    fromName: "UNNATI PHARMAX",
    fromAddress: "Ground Floor House No 307/4, Guru Vandana Apartment,\nKakasaheb Cholkar Marg, Lakadganj, Nagpur, 440008",
    fromEmail: "",
    fromPhone: "",
    toName: "",
    toAddress: "",
    toEmail: "",
    quoteNo: "Q-001",
    quoteDate: today(),
    validUntil: addDays(today(), 30),
    currency: "USD",
    taxLabel: "GST",
    taxPercent: 0,
    items: [newItem()],
    notes: "",
    terms: "",
  });

  const set = useCallback(<K extends keyof QuotationData>(key: K, val: QuotationData[K]) => {
    setQ((prev) => ({ ...prev, [key]: val }));
  }, []);

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => set("logoUrl", ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function updateItem(id: number, field: keyof LineItem, value: string | number) {
    setQ((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  }

  function addItem() {
    setQ((prev) => ({ ...prev, items: [...prev.items, newItem()] }));
  }

  function removeItem(id: number) {
    setQ((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((i) => i.id !== id) : prev.items,
    }));
  }

  const subtotal = q.items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const taxAmt = subtotal * (q.taxPercent / 100);
  const total = subtotal + taxAmt;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--surface-2)",
    color: "var(--text-primary)",
    fontSize: "0.85rem",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    color: "var(--text-muted)",
    marginBottom: 4,
    display: "block",
  };
  const sectionHead: React.CSSProperties = {
    fontWeight: 700,
    fontSize: "0.8rem",
    textTransform: "uppercase",
    color: "var(--accent)",
    marginBottom: 10,
    letterSpacing: 0.5,
  };

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #quotation-preview, #quotation-preview * { visibility: visible !important; }
          #quotation-preview {
            position: absolute !important;
            top: 0 !important; left: 0 !important; right: 0 !important;
            padding: 20mm 20mm !important;
          }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Quotation Generator</h2>
        <button
          onClick={printQuotation}
          style={{
            padding: "8px 22px",
            background: "#1a3c6e",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          🖨 Print / Download PDF
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 24, alignItems: "start" }}>

        {/* ── LEFT: Form ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Logo */}
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: 16 }}>
            <div style={sectionHead}>Logo</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {q.logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={q.logoUrl} alt="logo" style={{ maxHeight: 52, maxWidth: 140, borderRadius: 4 }} />
                : <div style={{ width: 100, height: 44, border: "1.5px dashed var(--border)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.75rem" }}>No logo</div>
              }
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => fileRef.current?.click()} className="btn btn-secondary btn-sm">Upload</button>
                {q.logoUrl && <button onClick={() => set("logoUrl", null)} className="btn btn-secondary btn-sm">Remove</button>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogo} />
            </div>
          </div>

          {/* From */}
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: 16 }}>
            <div style={sectionHead}>From</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <label style={labelStyle}>Company Name</label>
                <input style={inputStyle} value={q.fromName} onChange={e => set("fromName", e.target.value)} placeholder="Your company name" />
              </div>
              <div>
                <label style={labelStyle}>Address</label>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 56 }} value={q.fromAddress} onChange={e => set("fromAddress", e.target.value)} placeholder="Street, City, Zip, Country" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} value={q.fromEmail} onChange={e => set("fromEmail", e.target.value)} placeholder="email@company.com" />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} value={q.fromPhone} onChange={e => set("fromPhone", e.target.value)} placeholder="+91 ..." />
                </div>
              </div>
            </div>
          </div>

          {/* To */}
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: 16 }}>
            <div style={sectionHead}>Bill To</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <label style={labelStyle}>Client Name</label>
                <input style={inputStyle} value={q.toName} onChange={e => set("toName", e.target.value)} placeholder="Client / company name" />
              </div>
              <div>
                <label style={labelStyle}>Address</label>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 56 }} value={q.toAddress} onChange={e => set("toAddress", e.target.value)} placeholder="Street, City, Country" />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} value={q.toEmail} onChange={e => set("toEmail", e.target.value)} placeholder="client@email.com" />
              </div>
            </div>
          </div>

          {/* Quote details */}
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: 16 }}>
            <div style={sectionHead}>Quote Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={labelStyle}>Quote Number</label>
                <input style={inputStyle} value={q.quoteNo} onChange={e => set("quoteNo", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Currency</label>
                <select style={inputStyle} value={q.currency} onChange={e => set("currency", e.target.value)}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Quote Date</label>
                <input style={inputStyle} type="date" value={q.quoteDate} onChange={e => set("quoteDate", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Valid Until</label>
                <input style={inputStyle} type="date" value={q.validUntil} onChange={e => set("validUntil", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Tax */}
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: 16 }}>
            <div style={sectionHead}>Tax</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={labelStyle}>Tax Label</label>
                <input style={inputStyle} value={q.taxLabel} onChange={e => set("taxLabel", e.target.value)} placeholder="GST / VAT / Tax" />
              </div>
              <div>
                <label style={labelStyle}>Tax %</label>
                <input style={inputStyle} type="number" min={0} max={100} value={q.taxPercent} onChange={e => set("taxPercent", parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          {/* Notes / Terms */}
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: 16 }}>
            <div style={sectionHead}>Notes & Terms</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 56 }} value={q.notes} onChange={e => set("notes", e.target.value)} placeholder="Payment instructions, thank you note..." />
              </div>
              <div>
                <label style={labelStyle}>Terms & Conditions</label>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 56 }} value={q.terms} onChange={e => set("terms", e.target.value)} placeholder="Return policy, delivery terms..." />
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Preview ── */}
        <div style={{ position: "sticky", top: 20 }}>

          {/* Line items editor */}
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={sectionHead}>Line Items</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  <th style={{ textAlign: "left", padding: "0 6px 6px 0", width: "46%" }}>Description</th>
                  <th style={{ textAlign: "right", padding: "0 6px 6px", width: "14%" }}>Qty</th>
                  <th style={{ textAlign: "right", padding: "0 6px 6px", width: "18%" }}>Rate</th>
                  <th style={{ textAlign: "right", padding: "0 6px 6px", width: "16%" }}>Amount</th>
                  <th style={{ width: 28 }}></th>
                </tr>
              </thead>
              <tbody>
                {q.items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: "3px 6px 3px 0" }}>
                      <input
                        style={inputStyle}
                        value={item.description}
                        onChange={e => updateItem(item.id, "description", e.target.value)}
                        placeholder="Item description"
                      />
                    </td>
                    <td style={{ padding: "3px 6px" }}>
                      <input
                        style={{ ...inputStyle, textAlign: "right" }}
                        type="number" min={0}
                        value={item.quantity}
                        onChange={e => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td style={{ padding: "3px 6px" }}>
                      <input
                        style={{ ...inputStyle, textAlign: "right" }}
                        type="number" min={0} step="0.01"
                        value={item.rate}
                        onChange={e => updateItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                      {(item.quantity * item.rate).toFixed(2)}
                    </td>
                    <td style={{ padding: "3px 0 3px 4px" }}>
                      <button
                        onClick={() => removeItem(item.id)}
                        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1rem", lineHeight: 1, padding: 2 }}
                        title="Remove"
                      >×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={addItem} className="btn btn-secondary btn-sm" style={{ marginTop: 10 }}>
              + Add Line Item
            </button>

            {/* Totals summary */}
            <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, fontSize: "0.85rem" }}>
              <div style={{ display: "flex", gap: 32 }}>
                <span style={{ color: "var(--text-muted)" }}>Subtotal</span>
                <span>{subtotal.toFixed(2)} {q.currency}</span>
              </div>
              {q.taxPercent > 0 && (
                <div style={{ display: "flex", gap: 32 }}>
                  <span style={{ color: "var(--text-muted)" }}>{q.taxLabel} ({q.taxPercent}%)</span>
                  <span>{taxAmt.toFixed(2)} {q.currency}</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 32, fontWeight: 700, fontSize: "1rem", color: "var(--accent)", marginTop: 4 }}>
                <span>Total</span>
                <span>{total.toFixed(2)} {q.currency}</span>
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
            <div style={{ background: "var(--surface-1)", padding: "8px 16px", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)" }}>
              PREVIEW
            </div>
            <div style={{ transform: "scale(0.72)", transformOrigin: "top left", width: "138.9%", pointerEvents: "none" }}>
              <QuotationPreview q={q} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
