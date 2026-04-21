"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import {
  getAllCountries, getItpsRate, getEmsRate, getCmRate,
  calcItps, calcEmsOrCm,
  type ItpsRate,
} from "../../../lib/shippingRates";

// ── Types ─────────────────────────────────────────────────────────────────────
type ProductOption = {
  id: string;
  name: string;
  unitType: string | null;
  unitWeightKg: number | null;
};

const DEFAULT_UNIT_WEIGHTS: Record<string, number> = {
  Strip: 0.00823,
  Tube:  0.0395,
};

function resolveUnitWeight(p: ProductOption): number | null {
  if (p.unitWeightKg) return p.unitWeightKg;
  if (p.unitType && DEFAULT_UNIT_WEIGHTS[p.unitType]) return DEFAULT_UNIT_WEIGHTS[p.unitType];
  return null;
}

type LineItem = {
  id: number;
  description: string;
  quantity: number;
  rate: number;
  productId: string;
  unitWeightKg: number | null;
  weightSource: "product" | "formula" | "none";
};

type ExtraCharge = {
  id: number;
  label: string;
  amount: number;
};

type QuotationData = {
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
  items: LineItem[];
  extraCharges: ExtraCharge[];
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bankBranch: string;
  bankSwift: string;
  notes: string;
  terms: string;
};

const CURRENCIES = ["USD", "INR", "EUR", "GBP", "AUD", "CAD", "AED"];

function today() { return new Date().toISOString().split("T")[0]; }
function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function fmtNum(n: number) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function fmtCur(n: number, currency: string) { return `${fmtNum(n)} ${currency}`; }

let _itemId   = 1;
let _extraId  = 1;
function newItem(): LineItem {
  return { id: _itemId++, description: "", quantity: 1, rate: 0, productId: "", unitWeightKg: null, weightSource: "none" };
}
function newExtra(label = ""): ExtraCharge {
  return { id: _extraId++, label, amount: 0 };
}

function printQuotation() { window.print(); }

// ── Auto quote number (localStorage counter) ──────────────────────────────────
function nextQuoteNo(): string {
  if (typeof window === "undefined") return "Q-001";
  const n = parseInt(localStorage.getItem("unnati_quote_counter") ?? "0", 10) + 1;
  localStorage.setItem("unnati_quote_counter", String(n));
  return `Q-${String(n).padStart(3, "0")}`;
}

// ── Shipping Calculator ───────────────────────────────────────────────────────
const SLAB_WEIGHTS_GM = [500, 1000, 1500, 2000];
const SLAB_LABELS     = ["0.5 kg", "1 kg", "1.5 kg", "2 kg"];
const ALL_COUNTRIES   = getAllCountries();

function ShippingCalculator({
  totalWeightKg,
  onAddShipping,
}: {
  totalWeightKg: number | null;
  onAddShipping: (amountInr: number, label: string) => void;
}) {
  const [country, setCountry] = useState("");
  const [search,  setSearch]  = useState("");
  const [open,    setOpen]    = useState(false);

  const filtered = useMemo(
    () => ALL_COUNTRIES.filter(c => c.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

  const itps = country ? getItpsRate(country) : undefined;
  const ems  = country ? getEmsRate(country)  : undefined;
  const cm   = country ? getCmRate(country)   : undefined;
  const actualGm = totalWeightKg != null ? Math.ceil(totalWeightKg * 1000) : null;

  type WeightRow = { label: string; gm: number; isActual?: boolean };
  const weightRows: WeightRow[] = [
    ...(actualGm != null ? [{ label: `Actual (${totalWeightKg!.toFixed(3)} kg)`, gm: actualGm, isActual: true }] : []),
    ...SLAB_WEIGHTS_GM.map((gm, i) => ({ label: SLAB_LABELS[i], gm })),
  ];

  function fmtInr(n: number | null) {
    if (n == null) return <span style={{ color: "var(--text-muted)" }}>N/A</span>;
    return <span style={{ fontFamily: "monospace" }}>₹{n.toLocaleString("en-IN")}</span>;
  }

  function exceedsMax(r: ItpsRate | undefined, gm: number) { return r && gm > r.maxKg * 1000; }

  const thS: React.CSSProperties = { padding: "7px 10px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", textAlign: "left", borderBottom: "1px solid var(--border)" };
  const tdS: React.CSSProperties = { padding: "7px 10px", fontSize: "0.82rem", borderBottom: "1px solid rgba(255,255,255,0.04)" };

  return (
    <div style={{ marginTop: 16, padding: "14px 16px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Shipping Calculator</span>
        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>India Post rates (ITPS / EMS / Air Parcel)</span>
      </div>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <input
          value={open ? search : country}
          onFocus={() => { setOpen(true); setSearch(""); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search destination country…"
          style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "0.85rem", boxSizing: "border-box" }}
        />
        {open && filtered.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, maxHeight: 200, overflowY: "auto", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 7, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", marginTop: 2 }}>
            {filtered.map(c => (
              <div key={c} onMouseDown={() => { setCountry(c); setSearch(""); setOpen(false); }}
                style={{ padding: "7px 12px", fontSize: "0.82rem", cursor: "pointer", background: c === country ? "rgba(99,102,241,0.15)" : "transparent", color: c === country ? "#818cf8" : "var(--text-primary)" }}>
                {c}
              </div>
            ))}
          </div>
        )}
      </div>

      {country && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...thS, width: "28%" }}>Weight</th>
                  <th style={{ ...thS, width: "24%" }}>ITPS{itps ? <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>(max {itps.maxKg}kg)</span> : ""}</th>
                  <th style={{ ...thS, width: "24%" }}>EMS (Speed Post)</th>
                  <th style={{ ...thS, width: "24%" }}>Air Parcel (CM)</th>
                </tr>
              </thead>
              <tbody>
                {weightRows.map(row => {
                  const itpsAmt = itps ? calcItps(itps, row.gm) : null;
                  const emsAmt  = ems  ? calcEmsOrCm(ems,  row.gm) : null;
                  const cmAmt   = cm   ? calcEmsOrCm(cm,   row.gm) : null;
                  const isOver  = exceedsMax(itps, row.gm);
                  return (
                    <tr key={row.label} style={{ background: row.isActual ? "rgba(99,102,241,0.08)" : "transparent" }}>
                      <td style={{ ...tdS, fontWeight: row.isActual ? 700 : 400, color: row.isActual ? "#818cf8" : "var(--text-primary)" }}>
                        {row.label}{row.isActual && <span style={{ fontSize: "0.65rem", marginLeft: 5, color: "#818cf8" }}>← actual</span>}
                      </td>
                      <td style={tdS}>{isOver ? <span style={{ fontSize: "0.72rem", color: "#f87171" }}>Exceeds max</span> : fmtInr(itpsAmt)}</td>
                      <td style={tdS}>{fmtInr(emsAmt)}</td>
                      <td style={tdS}>{fmtInr(cmAmt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {(itps || ems || cm) && (
            <div style={{ marginTop: 8, fontSize: "0.7rem", color: "var(--text-muted)", display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              {itps && <span>ITPS: ₹{itps.first50gm} first 50gm + ₹{itps.per50gm}/50gm</span>}
              {ems  && <span>EMS: ₹{ems.first250gm} first 250gm + ₹{ems.per250gm}/250gm</span>}
              {cm   && <span>Air Parcel: ₹{cm.first250gm} first 250gm + ₹{cm.per250gm}/250gm</span>}
            </div>
          )}
          {actualGm != null && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", alignSelf: "center" }}>Add to quote:</span>
              {itps && calcItps(itps, actualGm) != null && (
                <button onClick={() => onAddShipping(calcItps(itps, actualGm)!, `Shipping - ITPS (${country})`)} className="btn btn-secondary btn-sm" style={{ fontSize: "0.72rem" }}>
                  + ITPS ₹{calcItps(itps, actualGm)!.toLocaleString("en-IN")}
                </button>
              )}
              {ems && (
                <button onClick={() => onAddShipping(calcEmsOrCm(ems, actualGm), `Shipping - EMS (${country})`)} className="btn btn-secondary btn-sm" style={{ fontSize: "0.72rem" }}>
                  + EMS ₹{calcEmsOrCm(ems, actualGm).toLocaleString("en-IN")}
                </button>
              )}
              {cm && (
                <button onClick={() => onAddShipping(calcEmsOrCm(cm, actualGm), `Shipping - Air Parcel (${country})`)} className="btn btn-secondary btn-sm" style={{ fontSize: "0.72rem" }}>
                  + Air Parcel ₹{calcEmsOrCm(cm, actualGm).toLocaleString("en-IN")}
                </button>
              )}
            </div>
          )}
          {!itps && !ems && !cm && (
            <div style={{ fontSize: "0.78rem", color: "#f87171", marginTop: 4 }}>No rates found for "{country}".</div>
          )}
        </>
      )}
    </div>
  );
}

// ── Weight summary bar ────────────────────────────────────────────────────────
function WeightBar({ items }: { items: LineItem[] }) {
  const rows = items.filter(i => i.unitWeightKg != null);
  if (rows.length === 0) return null;
  const totalKg = rows.reduce((s, i) => s + i.unitWeightKg! * i.quantity, 0);
  return (
    <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.22)", borderRadius: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.05em" }}>Estimated Parcel Weight</span>
      <span style={{ fontWeight: 700, fontSize: "1rem", color: "#10b981", fontFamily: "monospace" }}>{totalKg.toFixed(3)} kg</span>
      <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
        {rows.map(i => (
          <span key={i.id} style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            {i.description || "Item"}: {i.quantity} × {i.unitWeightKg!.toFixed(5)} kg = <strong style={{ color: "var(--text-secondary)" }}>{(i.unitWeightKg! * i.quantity).toFixed(3)} kg</strong>
            {i.weightSource === "formula" && <em style={{ color: "#f59e0b", marginLeft: 4 }}>(formula)</em>}
            {i.weightSource === "product" && <em style={{ color: "#10b981", marginLeft: 4 }}>(product)</em>}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Quotation Preview (printed format) ────────────────────────────────────────
type Websites = { website: string; indiamart: string; marketing: string };
function QuotationPreview({ q, totalWeightKg, websites }: { q: QuotationData; totalWeightKg: number | null; websites: Websites }) {
  const subtotal    = q.items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const extraTotal  = q.extraCharges.reduce((s, c) => s + c.amount, 0);
  const grandTotal  = subtotal + extraTotal;

  const accentBlue = "#1a3c6e";
  const th: React.CSSProperties = {
    background: accentBlue, color: "#fff", fontWeight: 700, textAlign: "left",
    padding: "8px 10px", fontSize: "8.5pt", border: "1px solid #c8d6e8",
  };
  const td: React.CSSProperties = {
    border: "1px solid #dde3ed", padding: "7px 10px", fontSize: "8.5pt", verticalAlign: "top",
  };

  const hasBank = q.bankName || q.bankAccount || q.bankIfsc || q.bankBranch;

  return (
    <div id="quotation-preview" style={{ background: "#fff", color: "#1a1a1a", fontFamily: "Arial, sans-serif", fontSize: "9pt", padding: "28px 34px", minHeight: 900 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, borderBottom: `3px solid ${accentBlue}`, paddingBottom: 16 }}>
        {/* Left: Logo + Company */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Unnati Pharmax" style={{ height: 70, width: "auto", objectFit: "contain" }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: "13pt", color: accentBlue, letterSpacing: "-0.01em" }}>{q.fromName}</div>
            <div style={{ whiteSpace: "pre-line", color: "#555", fontSize: "8pt", marginTop: 2, lineHeight: 1.5 }}>{q.fromAddress}</div>
            {q.fromEmail && <div style={{ color: "#555", fontSize: "8pt" }}>✉ {q.fromEmail}</div>}
            {q.fromPhone && <div style={{ color: "#555", fontSize: "8pt" }}>✆ {q.fromPhone}</div>}
            {websites.website  && <div style={{ color: "#555", fontSize: "8pt" }}>🌐 {websites.website}</div>}
            {websites.indiamart && <div style={{ color: "#555", fontSize: "8pt" }}>🛒 {websites.indiamart}</div>}
            {websites.marketing && <div style={{ color: "#555", fontSize: "8pt" }}>📣 {websites.marketing}</div>}
          </div>
        </div>

        {/* Right: QUOTATION title + meta */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "24pt", fontWeight: 700, color: accentBlue, letterSpacing: 2, lineHeight: 1 }}>QUOTATION</div>
          <table style={{ marginTop: 10, marginLeft: "auto", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ padding: "3px 10px 3px 0", color: "#666", fontSize: "8pt", fontWeight: 600 }}>Quote No.</td>
                <td style={{ padding: "3px 0", fontFamily: "monospace", fontWeight: 700, color: accentBlue, fontSize: "10pt" }}>{q.quoteNo || "—"}</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 10px 3px 0", color: "#666", fontSize: "8pt" }}>Date</td>
                <td style={{ padding: "3px 0" }}>{new Date(q.quoteDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 10px 3px 0", color: "#666", fontSize: "8pt" }}>Valid Until</td>
                <td style={{ padding: "3px 0" }}>{new Date(q.validUntil).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
              </tr>
              {totalWeightKg != null && (
                <tr>
                  <td style={{ padding: "3px 10px 3px 0", color: "#666", fontSize: "8pt" }}>Est. Weight</td>
                  <td style={{ padding: "3px 0", fontWeight: 600, color: "#1a7c5e" }}>{totalWeightKg.toFixed(3)} kg</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bill To ── */}
      <div style={{ marginBottom: 18, background: "#f0f4fa", borderLeft: `4px solid ${accentBlue}`, borderRadius: "0 6px 6px 0", padding: "10px 14px" }}>
        <div style={{ fontWeight: 700, color: accentBlue, marginBottom: 4, fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.08em" }}>Bill To</div>
        <div style={{ fontWeight: 700, fontSize: "10.5pt" }}>{q.toName || "—"}</div>
        {q.toAddress && <div style={{ whiteSpace: "pre-line", color: "#555", fontSize: "8pt", marginTop: 2 }}>{q.toAddress}</div>}
        {q.toEmail   && <div style={{ color: "#555", fontSize: "8pt", marginTop: 2 }}>✉ {q.toEmail}</div>}
      </div>

      {/* ── Items Table ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <thead>
          <tr>
            <th style={{ ...th, width: "4%",  textAlign: "center" }}>#</th>
            <th style={{ ...th, width: "44%" }}>Description</th>
            <th style={{ ...th, width: "9%",  textAlign: "right" }}>Qty</th>
            <th style={{ ...th, width: "16%", textAlign: "right" }}>Rate ({q.currency})</th>
            <th style={{ ...th, width: "12%", textAlign: "right" }}>Weight (kg)</th>
            <th style={{ ...th, width: "15%", textAlign: "right" }}>Amount ({q.currency})</th>
          </tr>
        </thead>
        <tbody>
          {q.items.map((item, idx) => (
            <tr key={item.id} style={{ background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
              <td style={{ ...td, textAlign: "center", color: "#888" }}>{idx + 1}</td>
              <td style={td}>{item.description || <span style={{ color: "#bbb" }}>—</span>}</td>
              <td style={{ ...td, textAlign: "right" }}>{item.quantity}</td>
              <td style={{ ...td, textAlign: "right" }}>{fmtNum(item.rate)}</td>
              <td style={{ ...td, textAlign: "right", color: "#1a7c5e" }}>
                {item.unitWeightKg != null ? (item.unitWeightKg * item.quantity).toFixed(3) : "—"}
              </td>
              <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmtNum(item.quantity * item.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Totals block ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <table style={{ borderCollapse: "collapse", minWidth: 300 }}>
          <tbody>
            <tr>
              <td style={{ padding: "5px 16px 5px 0", color: "#555", borderTop: "1px solid #dde3ed" }}>Subtotal</td>
              <td style={{ padding: "5px 0", textAlign: "right", fontFamily: "monospace", borderTop: "1px solid #dde3ed" }}>{fmtCur(subtotal, q.currency)}</td>
            </tr>
            {q.extraCharges.filter(c => c.label || c.amount > 0).map(c => (
              <tr key={c.id}>
                <td style={{ padding: "4px 16px 4px 0", color: "#444" }}>{c.label || "Additional Charge"}</td>
                <td style={{ padding: "4px 0", textAlign: "right", fontFamily: "monospace" }}>{fmtCur(c.amount, q.currency)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} style={{ borderTop: `2px solid ${accentBlue}`, padding: "6px 0 0" }} />
            </tr>
            <tr>
              <td style={{ padding: "4px 16px 4px 0", fontWeight: 700, fontSize: "12pt", color: accentBlue }}>GRAND TOTAL</td>
              <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 700, fontSize: "12pt", color: accentBlue, fontFamily: "monospace" }}>{fmtCur(grandTotal, q.currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Bank Details + Notes/Terms ── */}
      <div style={{ display: "grid", gridTemplateColumns: hasBank ? "1fr 1fr" : "1fr", gap: 20, marginTop: 8 }}>
        {hasBank && (
          <div style={{ background: "#f0f4fa", borderRadius: 6, padding: "12px 14px" }}>
            <div style={{ fontWeight: 700, color: accentBlue, fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Bank Details</div>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <tbody>
                {[
                  ["Bank Name",    q.bankName],
                  ["Account No.",  q.bankAccount],
                  ["IFSC Code",    q.bankIfsc],
                  ["Branch",       q.bankBranch],
                  ["SWIFT / BIC",  q.bankSwift],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <tr key={label}>
                    <td style={{ padding: "2px 10px 2px 0", fontSize: "8pt", color: "#666", fontWeight: 600, whiteSpace: "nowrap" }}>{label}</td>
                    <td style={{ padding: "2px 0", fontSize: "8.5pt", fontFamily: label === "Account No." || label === "IFSC Code" ? "monospace" : undefined }}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {q.notes && (
            <div>
              <div style={{ fontWeight: 700, color: accentBlue, fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Notes</div>
              <div style={{ whiteSpace: "pre-line", color: "#555", fontSize: "8pt", lineHeight: 1.6 }}>{q.notes}</div>
            </div>
          )}
          {q.terms && (
            <div>
              <div style={{ fontWeight: 700, color: accentBlue, fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Terms & Conditions</div>
              <div style={{ whiteSpace: "pre-line", color: "#555", fontSize: "8pt", lineHeight: 1.6 }}>{q.terms}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 32, borderTop: "1px solid #e5e7eb", paddingTop: 8, textAlign: "center", color: "#aaa", fontSize: "7pt" }}>
        This is a computer-generated quotation — {q.fromName} · {q.fromEmail}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function QuotationClient() {
  const [products, setProducts] = useState<ProductOption[]>([]);

  useEffect(() => {
    fetch("/api/products")
      .then(r => r.json())
      .then(d => setProducts(
        (d.products ?? []).map((p: any) => ({
          id: p.id, name: p.name,
          unitType: p.unitType ?? null,
          unitWeightKg: p.unitWeightKg ?? null,
        }))
      ));
  }, []);

  const [q, setQ] = useState<QuotationData>(() => ({
    fromName:    "UNNATI PHARMAX",
    fromAddress: "1/04 Guruvanada Appartment, Central Ave, Lakadganj, Nagpur 440008",
    fromEmail:   "unnatipharmax@gmail.com",
    fromPhone:   "",
    toName:    "",
    toAddress: "",
    toEmail:   "",
    quoteNo:    nextQuoteNo(),
    quoteDate:  today(),
    validUntil: addDays(today(), 30),
    currency:   "USD",
    items:        [newItem()],
    extraCharges: [],
    bankName:    "",
    bankAccount: "",
    bankIfsc:    "",
    bankBranch:  "",
    bankSwift:   "",
    notes: "",
    terms: "1. Prices are valid for the period mentioned above.\n2. All disputes subject to Nagpur jurisdiction.",
  }));

  // Load company settings from API and pre-fill sender fields + bank details
  const [companyWebsites, setCompanyWebsites] = useState({ website: "", indiamart: "", marketing: "" });
  useEffect(() => {
    fetch("/api/settings/company")
      .then(r => r.json())
      .then(s => {
        setQ(prev => ({
          ...prev,
          fromName:    s.name    || prev.fromName,
          fromAddress: s.address || prev.fromAddress,
          fromEmail:   s.email   || prev.fromEmail,
          fromPhone:   s.phone   || prev.fromPhone,
          bankName:    s.bankName    || prev.bankName,
          bankAccount: s.bankAccount || prev.bankAccount,
          bankIfsc:    s.bankIfsc    || prev.bankIfsc,
          bankBranch:  s.bankBranch  || prev.bankBranch,
          bankSwift:   s.bankSwift   || prev.bankSwift,
        }));
        setCompanyWebsites({ website: s.website || "", indiamart: s.indiamart || "", marketing: s.marketing || "" });
      })
      .catch(() => {/* use defaults */});
  }, []);

  const set = useCallback(<K extends keyof QuotationData>(key: K, val: QuotationData[K]) => {
    setQ(prev => ({ ...prev, [key]: val }));
  }, []);

  // ── Item handlers ──
  function updateItem(id: number, field: keyof LineItem, value: string | number | null) {
    setQ(prev => ({ ...prev, items: prev.items.map(i => i.id === id ? { ...i, [field]: value } : i) }));
  }

  function handleProductSelect(itemId: number, productId: string) {
    const prod = products.find(p => p.id === productId);
    if (!prod) {
      setQ(prev => ({ ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, productId: "", unitWeightKg: null, weightSource: "none" } : i) }));
      return;
    }
    const unitWeight = resolveUnitWeight(prod);
    const source: LineItem["weightSource"] = prod.unitWeightKg ? "product" : (prod.unitType && DEFAULT_UNIT_WEIGHTS[prod.unitType] ? "formula" : "none");
    setQ(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === itemId
        ? { ...i, productId, description: i.description || prod.name, unitWeightKg: unitWeight, weightSource: source }
        : i
      ),
    }));
  }

  function addItem() { setQ(prev => ({ ...prev, items: [...prev.items, newItem()] })); }
  function removeItem(id: number) {
    setQ(prev => ({ ...prev, items: prev.items.length > 1 ? prev.items.filter(i => i.id !== id) : prev.items }));
  }
  function addShippingItem(amountInr: number, label: string) {
    setQ(prev => ({ ...prev, items: [...prev.items, { ...newItem(), description: label, quantity: 1, rate: amountInr }] }));
  }

  // ── Extra charge handlers ──
  function addExtra(label = "") { setQ(prev => ({ ...prev, extraCharges: [...prev.extraCharges, newExtra(label)] })); }
  function updateExtra(id: number, field: keyof ExtraCharge, value: string | number) {
    setQ(prev => ({ ...prev, extraCharges: prev.extraCharges.map(c => c.id === id ? { ...c, [field]: value } : c) }));
  }
  function removeExtra(id: number) {
    setQ(prev => ({ ...prev, extraCharges: prev.extraCharges.filter(c => c.id !== id) }));
  }

  // ── Derived values ──
  const weightItems  = q.items.filter(i => i.unitWeightKg != null);
  const totalWeightKg = weightItems.length > 0 ? weightItems.reduce((s, i) => s + i.unitWeightKg! * i.quantity, 0) : null;
  const subtotal     = q.items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const extraTotal   = q.extraCharges.reduce((s, c) => s + c.amount, 0);
  const grandTotal   = subtotal + extraTotal;

  const iS: React.CSSProperties = { width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "0.85rem", boxSizing: "border-box" };
  const lS: React.CSSProperties = { fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4, display: "block" };
  const sH: React.CSSProperties = { fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", color: "var(--accent)", marginBottom: 10, letterSpacing: 0.5 };

  const QUICK_EXTRAS = ["Service Charges", "Local Charges", "Handling Charges", "Insurance", "Documentation Fees", "Courier Charges"];

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #quotation-preview, #quotation-preview * { visibility: visible !important; }
          #quotation-preview { position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; padding: 15mm 18mm !important; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Quotation Generator</h2>
        <button onClick={printQuotation} style={{ padding: "8px 22px", background: "#1a3c6e", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.9rem", cursor: "pointer" }}>
          🖨 Print / Download PDF
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 24, alignItems: "start" }}>

        {/* ── LEFT PANEL ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* From */}
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: 16 }}>
            <div style={sH}>From (Your Details)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <label style={lS}>Company Name</label>
                <input style={iS} value={q.fromName} onChange={e => set("fromName", e.target.value)} />
              </div>
              <div>
                <label style={lS}>Address</label>
                <textarea style={{ ...iS, resize: "vertical", minHeight: 56 }} value={q.fromAddress} onChange={e => set("fromAddress", e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={lS}>Email</label>
                  <input style={iS} value={q.fromEmail} onChange={e => set("fromEmail", e.target.value)} />
                </div>
                <div>
                  <label style={lS}>Phone</label>
                  <input style={iS} value={q.fromPhone} onChange={e => set("fromPhone", e.target.value)} placeholder="+91 ..." />
                </div>
              </div>
            </div>
          </div>

          {/* To */}
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: 16 }}>
            <div style={sH}>Bill To (Client)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <label style={lS}>Client / Company Name</label>
                <input style={iS} value={q.toName} onChange={e => set("toName", e.target.value)} placeholder="Client name" />
              </div>
              <div>
                <label style={lS}>Address</label>
                <textarea style={{ ...iS, resize: "vertical", minHeight: 56 }} value={q.toAddress} onChange={e => set("toAddress", e.target.value)} placeholder="Street, City, Country" />
              </div>
              <div>
                <label style={lS}>Email</label>
                <input style={iS} value={q.toEmail} onChange={e => set("toEmail", e.target.value)} placeholder="client@email.com" />
              </div>
            </div>
          </div>

          {/* Quote Details */}
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: 16 }}>
            <div style={sH}>Quote Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={lS}>
                  Quote Number
                  <span style={{ marginLeft: 6, color: "var(--text-muted)", fontSize: "0.68rem" }}>(auto-generated)</span>
                </label>
                <input style={{ ...iS, fontFamily: "monospace", fontWeight: 700 }} value={q.quoteNo} onChange={e => set("quoteNo", e.target.value)} />
              </div>
              <div>
                <label style={lS}>Currency</label>
                <select style={iS} value={q.currency} onChange={e => set("currency", e.target.value)}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lS}>Quote Date</label>
                <input style={iS} type="date" value={q.quoteDate} onChange={e => set("quoteDate", e.target.value)} />
              </div>
              <div>
                <label style={lS}>Valid Until</label>
                <input style={iS} type="date" value={q.validUntil} onChange={e => set("validUntil", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: 16 }}>
            <div style={sH}>Bank Details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={lS}>Bank Name</label>
                  <input style={iS} value={q.bankName} onChange={e => set("bankName", e.target.value)} placeholder="e.g. State Bank of India" />
                </div>
                <div>
                  <label style={lS}>Branch</label>
                  <input style={iS} value={q.bankBranch} onChange={e => set("bankBranch", e.target.value)} placeholder="Branch name" />
                </div>
              </div>
              <div>
                <label style={lS}>Account Number</label>
                <input style={{ ...iS, fontFamily: "monospace" }} value={q.bankAccount} onChange={e => set("bankAccount", e.target.value)} placeholder="Account number" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={lS}>IFSC Code</label>
                  <input style={{ ...iS, fontFamily: "monospace" }} value={q.bankIfsc} onChange={e => set("bankIfsc", e.target.value.toUpperCase())} placeholder="SBIN0001234" />
                </div>
                <div>
                  <label style={lS}>SWIFT / BIC Code</label>
                  <input style={{ ...iS, fontFamily: "monospace" }} value={q.bankSwift} onChange={e => set("bankSwift", e.target.value.toUpperCase())} placeholder="For international wire" />
                </div>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: 16 }}>
            <div style={sH}>Notes & Terms</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <label style={lS}>Notes</label>
                <textarea style={{ ...iS, resize: "vertical", minHeight: 52 }} value={q.notes} onChange={e => set("notes", e.target.value)} placeholder="Payment instructions, thank you note…" />
              </div>
              <div>
                <label style={lS}>Terms & Conditions</label>
                <textarea style={{ ...iS, resize: "vertical", minHeight: 72 }} value={q.terms} onChange={e => set("terms", e.target.value)} placeholder="Return policy, delivery terms, jurisdiction…" />
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Line Items */}
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: 16 }}>
            <div style={sH}>Line Items (Products)</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {q.items.map((item, idx) => {
                const itemWeight = item.unitWeightKg != null ? item.unitWeightKg * item.quantity : null;
                return (
                  <div key={item.id} style={{ background: "var(--surface-2)", borderRadius: 8, padding: "10px 12px", border: "1px solid var(--border)" }}>
                    {/* Product picker */}
                    <div style={{ marginBottom: 6 }}>
                      <label style={{ ...lS, marginBottom: 3 }}>
                        Link to Product <span style={{ color: "var(--text-muted)" }}>(optional — auto-fills weight)</span>
                      </label>
                      <select value={item.productId} onChange={e => handleProductSelect(item.id, e.target.value)} style={{ ...iS, fontSize: "0.8rem" }}>
                        <option value="">— Free text / no product —</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.unitType ? ` (${p.unitType})` : ""}
                            {resolveUnitWeight(p) != null ? ` · ${resolveUnitWeight(p)!.toFixed(5)} kg/unit` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Fields row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 100px 80px 24px", gap: 6, alignItems: "end" }}>
                      <div>
                        <label style={{ ...lS, marginBottom: 2 }}>#{idx + 1} Description</label>
                        <input style={iS} value={item.description} onChange={e => updateItem(item.id, "description", e.target.value)} placeholder="Item description" />
                      </div>
                      <div>
                        <label style={{ ...lS, marginBottom: 2 }}>Qty</label>
                        <input style={{ ...iS, textAlign: "right" }} type="number" min={0} value={item.quantity} onChange={e => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label style={{ ...lS, marginBottom: 2 }}>Rate ({q.currency})</label>
                        <input style={{ ...iS, textAlign: "right" }} type="number" min={0} step="0.01" value={item.rate} onChange={e => updateItem(item.id, "rate", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label style={{ ...lS, marginBottom: 2 }}>
                          Wt (kg){item.weightSource === "formula" && <span style={{ color: "#f59e0b", marginLeft: 3, fontSize: "0.65rem" }}>~</span>}
                        </label>
                        <input style={{ ...iS, textAlign: "right", color: itemWeight != null ? "#10b981" : "var(--text-muted)", fontWeight: itemWeight != null ? 600 : 400 }}
                          value={itemWeight != null ? itemWeight.toFixed(3) : ""} readOnly placeholder="—" />
                      </div>
                      <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.1rem", paddingBottom: 2, alignSelf: "flex-end" }} title="Remove">×</button>
                    </div>

                    <div style={{ marginTop: 4, display: "flex", justifyContent: "flex-end", gap: 16, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      <span>Amount: <strong style={{ color: "var(--text-secondary)" }}>{fmtNum(item.quantity * item.rate)} {q.currency}</strong></span>
                      {itemWeight != null && <span style={{ color: "#10b981" }}>Weight: <strong>{itemWeight.toFixed(3)} kg</strong></span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={addItem} className="btn btn-secondary btn-sm" style={{ marginTop: 10 }}>+ Add Line Item</button>

            <WeightBar items={q.items} />
            <ShippingCalculator totalWeightKg={totalWeightKg} onAddShipping={addShippingItem} />
          </div>

          {/* Additional Charges */}
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={sH}>Additional Charges</div>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>service fees, local charges, etc.</span>
            </div>

            {/* Quick-add chips */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {QUICK_EXTRAS.map(label => (
                <button key={label} onClick={() => addExtra(label)} className="btn btn-secondary btn-sm" style={{ fontSize: "0.7rem", padding: "3px 10px" }}>
                  + {label}
                </button>
              ))}
              <button onClick={() => addExtra("")} className="btn btn-secondary btn-sm" style={{ fontSize: "0.7rem", padding: "3px 10px" }}>
                + Custom
              </button>
            </div>

            {q.extraCharges.length === 0 && (
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", padding: "8px 0" }}>
                No additional charges. Use the buttons above to add one.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {q.extraCharges.map(charge => (
                <div key={charge.id} style={{ display: "grid", gridTemplateColumns: "1fr 160px 28px", gap: 8, alignItems: "center" }}>
                  <input
                    style={iS}
                    value={charge.label}
                    onChange={e => updateExtra(charge.id, "label", e.target.value)}
                    placeholder="Charge description (e.g. Service Charges)"
                  />
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: "0.8rem", color: "var(--text-muted)", pointerEvents: "none" }}>{q.currency}</span>
                    <input
                      style={{ ...iS, textAlign: "right", paddingLeft: 40 }}
                      type="number" min={0} step="0.01"
                      value={charge.amount}
                      onChange={e => updateExtra(charge.id, "amount", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <button onClick={() => removeExtra(charge.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "1.1rem" }}>×</button>
                </div>
              ))}
            </div>

            {/* Totals summary */}
            <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, fontSize: "0.85rem" }}>
              <div style={{ display: "flex", gap: 32 }}>
                <span style={{ color: "var(--text-muted)" }}>Subtotal</span>
                <span style={{ fontFamily: "monospace" }}>{fmtNum(subtotal)} {q.currency}</span>
              </div>
              {q.extraCharges.filter(c => c.amount > 0).map(c => (
                <div key={c.id} style={{ display: "flex", gap: 32 }}>
                  <span style={{ color: "var(--text-muted)" }}>{c.label || "Additional Charge"}</span>
                  <span style={{ fontFamily: "monospace" }}>{fmtNum(c.amount)} {q.currency}</span>
                </div>
              ))}
              {totalWeightKg != null && (
                <div style={{ display: "flex", gap: 32, color: "#10b981" }}>
                  <span>Est. Parcel Weight</span>
                  <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{totalWeightKg.toFixed(3)} kg</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 32, fontWeight: 700, fontSize: "1.05rem", color: "var(--accent)", marginTop: 6, borderTop: "2px solid var(--accent)", paddingTop: 6 }}>
                <span>Grand Total</span>
                <span style={{ fontFamily: "monospace" }}>{fmtNum(grandTotal)} {q.currency}</span>
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
            <div style={{ background: "var(--surface-1)", padding: "8px 16px", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)" }}>
              PREVIEW (live)
            </div>
            <div style={{ transform: "scale(0.72)", transformOrigin: "top left", width: "138.9%", pointerEvents: "none" }}>
              <QuotationPreview q={q} totalWeightKg={totalWeightKg} websites={companyWebsites} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
