"use client";
import { useState, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
type Item = {
  id?:          string;
  productId:    string;
  productName:  string;
  composition:  string | null;
  pack:         string | null;
  quantity:     number;
  sellingPrice: number;
};

type Invoice = {
  id:                 string;
  invoiceNo:          string;
  invoiceGeneratedAt: string | null;
  status:             string;
  fullName:           string;
  address:            string;
  city:               string;
  state:              string;
  postalCode:         string;
  country:            string;
  email:              string;
  phone:              string;
  remitterName:       string;
  amountPaid:         number;
  currency:           string;
  exchangeRate:       number | null;
  dollarAmount:       number | null;
  inrAmount:          number | null;
  trackingNo:         string | null;
  licenseNo:          string | null;
  createdAt:          string;
  orderEntry: {
    shipmentMode:  string;
    shippingPrice: number;
    notes:         string | null;
    items:         Item[];
  } | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function isoDateVal(s: string | null) {
  if (!s) return "";
  return new Date(s).toISOString().split("T")[0];
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  PACKING:    { bg: "rgba(251,146,60,0.15)",  color: "#fb923c" },
  DISPATCHED: { bg: "rgba(110,231,183,0.15)", color: "#6ee7b7" },
  PAYMENT_VERIFIED: { bg: "rgba(99,102,241,0.15)", color: "#818cf8" },
};

const SHIPMENT_MODES = ["EMS", "ITPS", "RMS", "DHL", "UPS", "CM"];

// ── Edit Modal ─────────────────────────────────────────────────────────────────
function EditModal({ invoice, onClose, onSaved }: {
  invoice: Invoice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<"client" | "invoice" | "shipping" | "payment">("client");
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");
  const [success, setSuccess] = useState("");

  // Form state — client
  const [fullName,     setFullName]     = useState(invoice.fullName);
  const [address,      setAddress]      = useState(invoice.address);
  const [city,         setCity]         = useState(invoice.city);
  const [state,        setState]        = useState(invoice.state);
  const [postalCode,   setPostalCode]   = useState(invoice.postalCode);
  const [country,      setCountry]      = useState(invoice.country);
  const [email,        setEmail]        = useState(invoice.email);
  const [phone,        setPhone]        = useState(invoice.phone);
  const [remitterName, setRemitterName] = useState(invoice.remitterName);

  // Form state — invoice
  const [invoiceDate, setInvoiceDate] = useState(isoDateVal(invoice.invoiceGeneratedAt));
  const [trackingNo,  setTrackingNo]  = useState(invoice.trackingNo ?? "");
  const [licenseNo,   setLicenseNo]   = useState(invoice.licenseNo  ?? "");

  // Form state — shipping
  const [shipmentMode,  setShipmentMode]  = useState(invoice.orderEntry?.shipmentMode  ?? "EMS");
  const [shippingPrice, setShippingPrice] = useState(String(invoice.orderEntry?.shippingPrice ?? 0));
  const [notes,         setNotes]         = useState(invoice.orderEntry?.notes ?? "");
  const [items,         setItems]         = useState<Item[]>(invoice.orderEntry?.items ?? []);

  // Form state — payment
  const [amountPaid,   setAmountPaid]   = useState(String(invoice.amountPaid));
  const [currency,     setCurrency]     = useState(invoice.currency);
  const [exchangeRate, setExchangeRate] = useState(String(invoice.exchangeRate ?? ""));
  const [dollarAmount, setDollarAmount] = useState(String(invoice.dollarAmount ?? ""));
  const [inrAmount,    setInrAmount]    = useState(String(invoice.inrAmount    ?? ""));

  function updateItem(idx: number, key: keyof Item, val: string | number) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it));
  }

  async function save() {
    setSaving(true); setErr(""); setSuccess("");
    const body = {
      // client
      fullName, address, city, state, postalCode, country, email, phone, remitterName,
      // invoice
      invoiceGeneratedAt: invoiceDate || null,
      trackingNo:  trackingNo  || null,
      licenseNo:   licenseNo   || null,
      // shipping
      shipmentMode, shippingPrice: Number(shippingPrice) || 0, notes: notes || null,
      items: items.map(it => ({ productId: it.productId, quantity: Number(it.quantity), sellingPrice: Number(it.sellingPrice) })),
      // payment
      amountPaid:   Number(amountPaid)   || 0,
      currency,
      exchangeRate: exchangeRate ? Number(exchangeRate) : null,
      dollarAmount: dollarAmount ? Number(dollarAmount) : null,
      inrAmount:    inrAmount    ? Number(inrAmount)    : null,
    };

    const res  = await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setErr(data?.error || "Save failed"); return; }
    setSuccess("Invoice updated successfully.");
    onSaved();
  }

  const tabs: [typeof tab, string][] = [
    ["client",   "👤 Client Info"],
    ["invoice",  "🧾 Invoice & Shipping"],
    ["shipping", "📦 Items"],
    ["payment",  "💰 Payment"],
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div className="card" style={{ width: "min(680px, 96vw)", maxHeight: "92vh", display: "flex", flexDirection: "column", padding: 0 }}>
        {/* Header */}
        <div style={{ padding: "1.1rem 1.5rem 0", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Edit Invoice</h2>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 2 }}>
                <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#818cf8" }}>{invoice.invoiceNo}</span>
                <span style={{ marginLeft: 8 }}>{invoice.fullName}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.4rem", cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            {tabs.map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "0.5rem 1rem", fontSize: "0.8rem", fontWeight: 600,
                background: "none", border: "none", cursor: "pointer",
                borderBottom: tab === t ? "2px solid #6366f1" : "2px solid transparent",
                color: tab === t ? "#818cf8" : "var(--text-muted)",
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem" }}>
          {err     && <div className="alert alert-error"   style={{ marginBottom: "1rem", fontSize: "0.82rem" }}>{err}</div>}
          {success && <div className="alert alert-success" style={{ marginBottom: "1rem", fontSize: "0.82rem" }}>{success}</div>}

          {/* ── Client Info ── */}
          {tab === "client" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Full Name</label>
                  <input value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Remitter Name</label>
                  <input value={remitterName} onChange={e => setRemitterName(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Email</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Phone</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Address</label>
                <input value={address} onChange={e => setAddress(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.875rem" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>City</label>
                  <input value={city} onChange={e => setCity(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>State</label>
                  <input value={state} onChange={e => setState(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Postal Code</label>
                  <input value={postalCode} onChange={e => setPostalCode(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Country</label>
                <input value={country} onChange={e => setCountry(e.target.value)} />
              </div>
            </div>
          )}

          {/* ── Invoice & Shipping details ── */}
          {tab === "invoice" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Invoice Date</label>
                  <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Shipment Mode</label>
                  <select value={shipmentMode} onChange={e => setShipmentMode(e.target.value)}>
                    {SHIPMENT_MODES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Tracking Number</label>
                  <input value={trackingNo} onChange={e => setTrackingNo(e.target.value)} placeholder="Postal tracking ID" style={{ fontFamily: "monospace" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Drug License No.</label>
                  <input value={licenseNo} onChange={e => setLicenseNo(e.target.value)} placeholder="DL-XXXX" style={{ fontFamily: "monospace" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Shipping Price (₹)</label>
                  <input type="number" min="0" step="0.01" value={shippingPrice} onChange={e => setShippingPrice(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Notes</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any internal notes…" />
              </div>
            </div>
          )}

          {/* ── Items ── */}
          {tab === "shipping" && (
            <div>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
                Order Items
              </div>
              {items.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", padding: "1rem", border: "1px solid var(--border)", borderRadius: 8 }}>
                  No items in this order entry.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                  {items.map((item, idx) => (
                    <div key={item.id ?? idx} style={{ padding: "0.75rem", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-2)" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 6 }}>{item.productName}</div>
                      {item.composition && <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 8 }}>{item.composition}</div>}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
                        <div>
                          <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Quantity</label>
                          <input
                            type="number" min="1"
                            value={item.quantity}
                            onChange={e => updateItem(idx, "quantity", Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Selling Price (USD)</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={item.sellingPrice}
                            onChange={e => updateItem(idx, "sellingPrice", Number(e.target.value))}
                            style={{ fontFamily: "monospace" }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Payment ── */}
          {tab === "payment" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Amount Paid</label>
                  <input type="number" min="0" step="0.01" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} style={{ fontFamily: "monospace" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Currency</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}>
                    {["USD","EUR","GBP","INR","AUD","CAD","SGD"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Dollar Amount</label>
                  <input type="number" min="0" step="0.01" value={dollarAmount} onChange={e => setDollarAmount(e.target.value)} style={{ fontFamily: "monospace" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Exchange Rate</label>
                  <input type="number" min="0" step="0.01" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} style={{ fontFamily: "monospace" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>INR Amount</label>
                  <input type="number" min="0" step="0.01" value={inrAmount} onChange={e => setInrAmount(e.target.value)} style={{ fontFamily: "monospace" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "0.875rem 1.5rem", borderTop: "1px solid var(--border)", display: "flex", gap: "0.75rem" }}>
          <button onClick={save} disabled={saving} className="btn btn-primary">
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function InvoicesClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [editing,  setEditing]  = useState<Invoice | null>(null);
  const [err,      setErr]      = useState("");

  const load = useCallback(async (q = "") => {
    setLoading(true); setErr("");
    const res  = await fetch(`/api/invoices?search=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!res.ok) { setErr(data?.error || "Failed to load"); setLoading(false); return; }
    setInvoices(data.orders ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  function handleSearch(v: string) {
    setSearch(v);
    load(v);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1>Edit Invoices</h1>
          <p style={{ marginTop: "0.25rem" }}>{invoices.length} invoice{invoices.length !== 1 ? "s" : ""} found</p>
        </div>
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search invoice no., name, email, tracking…"
          style={{ padding: "0.5rem 0.75rem", minWidth: 280, fontSize: "0.875rem" }}
        />
      </div>

      {err && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{err}</div>}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />)}
        </div>
      ) : invoices.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem", opacity: 0.4 }}>🧾</div>
          <div style={{ fontWeight: 600 }}>No invoices found</div>
          <div style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
            {search ? "Try a different search term." : "No invoiced orders yet."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {invoices.map(inv => {
            const sc = STATUS_COLOR[inv.status] ?? { bg: "rgba(156,163,175,0.15)", color: "#9ca3af" };
            return (
              <div key={inv.id} className="card" style={{ padding: "0.875rem 1rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.95rem", color: "#818cf8" }}>
                        {inv.invoiceNo}
                      </span>
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "2px 7px", borderRadius: 4, background: sc.bg, color: sc.color }}>
                        {inv.status.replace("_", " ")}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        {fmtDate(inv.invoiceGeneratedAt ?? inv.createdAt)}
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.2rem" }}>{inv.fullName}</div>
                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                      <span>📍 {inv.city}, {inv.country}</span>
                      {inv.trackingNo && <span style={{ fontFamily: "monospace" }}>🚚 {inv.trackingNo}</span>}
                      {inv.orderEntry?.shipmentMode && <span>{inv.orderEntry.shipmentMode}</span>}
                      <span style={{ fontFamily: "monospace", color: "#6ee7b7" }}>
                        {inv.currency} {inv.amountPaid.toFixed(2)}
                      </span>
                      {inv.orderEntry && (
                        <span style={{ color: "var(--text-muted)" }}>
                          {inv.orderEntry.items.length} item{inv.orderEntry.items.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setEditing(inv)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.78rem", flexShrink: 0 }}
                  >
                    ✏️ Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <EditModal
          invoice={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { load(search); }}
        />
      )}
    </div>
  );
}
