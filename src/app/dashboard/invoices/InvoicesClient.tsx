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
  prescriptionFileName: string | null;
  dosagePerDay:        number | null;
  totalDosages:        number | null;
  dosageStartDate:     string | null;
  dosageReminderDate:  string | null;
  dosageReminderSent:  boolean;
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
  PACKING:          { bg: "rgba(251,146,60,0.15)",  color: "#fb923c" },
  DISPATCHED:       { bg: "rgba(110,231,183,0.15)", color: "#6ee7b7" },
  PAYMENT_VERIFIED: { bg: "rgba(99,102,241,0.15)",  color: "#818cf8" },
};

const SHIPMENT_MODES = ["EMS", "ITPS", "RMS", "DHL", "UPS", "CM"];

// ── Invoice Inline Editor ──────────────────────────────────────────────────────
function InvoiceInlineEditor({ invoice, onClose, onSaved }: {
  invoice: Invoice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");
  const [success, setSuccess] = useState("");

  // Client
  const [fullName,     setFullName]     = useState(invoice.fullName);
  const [address,      setAddress]      = useState(invoice.address);
  const [city,         setCity]         = useState(invoice.city);
  const [state,        setState]        = useState(invoice.state);
  const [postalCode,   setPostalCode]   = useState(invoice.postalCode);
  const [country,      setCountry]      = useState(invoice.country);
  const [email,        setEmail]        = useState(invoice.email);
  const [phone,        setPhone]        = useState(invoice.phone);
  const [remitterName, setRemitterName] = useState(invoice.remitterName);

  // Invoice meta
  const [invoiceDate, setInvoiceDate] = useState(isoDateVal(invoice.invoiceGeneratedAt));
  const [trackingNo,  setTrackingNo]  = useState(invoice.trackingNo  ?? "");
  const [licenseNo,   setLicenseNo]   = useState(invoice.licenseNo   ?? "");

  // Shipping
  const [shipmentMode,  setShipmentMode]  = useState(invoice.orderEntry?.shipmentMode  ?? "EMS");
  const [shippingPrice, setShippingPrice] = useState(String(invoice.orderEntry?.shippingPrice ?? 0));
  const [notes,         setNotes]         = useState(invoice.orderEntry?.notes ?? "");
  const [items,         setItems]         = useState<Item[]>(invoice.orderEntry?.items ?? []);

  // Payment
  const [amountPaid,   setAmountPaid]   = useState(String(invoice.amountPaid));
  const [currency,     setCurrency]     = useState(invoice.currency);
  const [exchangeRate, setExchangeRate] = useState(String(invoice.exchangeRate ?? "84"));
  const [dollarAmount, setDollarAmount] = useState(String(invoice.dollarAmount ?? ""));
  const [inrAmount,    setInrAmount]    = useState(String(invoice.inrAmount    ?? ""));

  // Dosage
  const [dosagePerDay,    setDosagePerDay]    = useState(String(invoice.dosagePerDay    ?? ""));
  const [totalDosages,    setTotalDosages]    = useState(String(invoice.totalDosages    ?? ""));
  const [dosageStartDate, setDosageStartDate] = useState(isoDateVal(invoice.dosageStartDate));
  const [dosageSaving,    setDosageSaving]    = useState(false);
  const [dosageSuccess,   setDosageSuccess]   = useState("");

  function updateItem(idx: number, key: keyof Item, val: string | number) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it));
  }

  // Computed invoice values (live)
  const exchRate   = parseFloat(exchangeRate) || 84;
  const expCnfUsd  = parseFloat(dollarAmount) || 0;
  const expShipUsd = parseFloat(shippingPrice) || 0;
  const expFobUsd  = Math.max(0, expCnfUsd - expShipUsd);
  const totalQty   = items.reduce((s, i) => s + Number(i.quantity), 0);
  const expFobInr  = Math.round(expFobUsd  * exchRate * 100) / 100;
  const expCnfInr  = Math.round(expCnfUsd  * exchRate * 100) / 100;

  // Dosage computed
  const perDay    = parseInt(dosagePerDay) || 0;
  const total     = parseInt(totalDosages) || 0;
  const daysSupply  = perDay > 0 && total > 0 ? Math.floor(total / perDay) : 0;
  const reminderDay = daysSupply > 7 ? daysSupply - 7 : daysSupply;
  function previewReminderDate() {
    if (!dosageStartDate || daysSupply === 0) return null;
    const d = new Date(dosageStartDate);
    d.setDate(d.getDate() + reminderDay);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  async function saveDosage() {
    if (!dosagePerDay || !totalDosages) { setErr("Dosage per day and total dosages are required"); return; }
    setDosageSaving(true); setErr(""); setDosageSuccess("");
    const res = await fetch(`/api/orders/${invoice.id}/dosage`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dosagePerDay:    Number(dosagePerDay),
        totalDosages:    Number(totalDosages),
        dosageStartDate: dosageStartDate || null,
      }),
    });
    const data = await res.json();
    setDosageSaving(false);
    if (!res.ok) { setErr(data?.error || "Failed to save dosage"); return; }
    setDosageSuccess(`Reminder scheduled for ${data.dosageReminderDate} (${data.daysSupply} day supply).`);
    onSaved();
  }

  async function save() {
    setSaving(true); setErr(""); setSuccess("");
    const body = {
      fullName, address, city, state, postalCode, country, email, phone, remitterName,
      invoiceGeneratedAt: invoiceDate || null,
      trackingNo:  trackingNo  || null,
      licenseNo:   licenseNo   || null,
      shipmentMode,
      shippingPrice: Number(shippingPrice) || 0,
      notes: notes || null,
      items: items.map(it => ({ productId: it.productId, quantity: Number(it.quantity), sellingPrice: Number(it.sellingPrice) })),
      amountPaid:   Number(amountPaid)   || 0,
      currency,
      exchangeRate: exchangeRate ? Number(exchangeRate) : null,
      dollarAmount: dollarAmount ? Number(dollarAmount) : null,
      inrAmount:    inrAmount    ? Number(inrAmount)    : null,
    };
    try {
      const res  = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data?.error || "Save failed"); return; }
      setSuccess("Saved!");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  // Table cell base styles (invoice format)
  const td:   React.CSSProperties = { border: "1px solid #000", padding: "3px 5px", verticalAlign: "top", color: "#000", fontSize: "9px" };
  const tdSm: React.CSSProperties = { ...td, fontSize: "8px" };
  const tbl:  React.CSSProperties = { width: "100%", borderCollapse: "collapse" as const };

  // Shared style for below-invoice auxiliary input boxes
  const auxInput: React.CSSProperties = { border: "1px solid #ccc", borderRadius: 4, padding: "4px 6px", width: "100%", fontSize: 12, color: "#000", background: "#fff", outline: "none" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "#111827", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Sticky top bar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.65rem 1.25rem", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Edit Invoice</span>
          <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#818cf8", fontSize: "0.9rem" }}>{invoice.invoiceNo}</span>
          <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{invoice.fullName}</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {err     && <span style={{ fontSize: "0.8rem", color: "#f87171", maxWidth: 300 }}>{err}</span>}
          {success && <span style={{ fontSize: "0.8rem", color: "#6ee7b7" }}>{success}</span>}
          <button onClick={save} disabled={saving} className="btn btn-primary" style={{ fontSize: "0.8rem", padding: "0.4rem 1rem" }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={onClose} className="btn btn-secondary" style={{ fontSize: "0.8rem", padding: "0.4rem 0.875rem" }}>Cancel</button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", background: "#e5e7eb" }}>
        <div id="invoice-edit-root" style={{ maxWidth: 960, margin: "0 auto", background: "#fff", padding: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.18)", fontFamily: "Arial,sans-serif", fontSize: "9px" }}>
          <style>{`
            #invoice-edit-root * { box-sizing: border-box; }
            #invoice-edit-root input, #invoice-edit-root select {
              border: none !important;
              border-bottom: 1.5px solid #aaa !important;
              background: transparent !important;
              color: #000 !important;
              outline: none !important;
              font-family: inherit !important;
              font-size: inherit !important;
              padding: 0 2px !important;
              width: 100% !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }
            #invoice-edit-root input:focus, #invoice-edit-root select:focus {
              border-bottom-color: #4f46e5 !important;
              background: rgba(79,70,229,0.04) !important;
            }
            #invoice-edit-root input[type="date"] { cursor: pointer; }
            #invoice-edit-root input[type="number"] { -moz-appearance: textfield; }
            #invoice-edit-root input[type="number"]::-webkit-outer-spin-button,
            #invoice-edit-root input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
            #invoice-edit-root thead { background: transparent !important; }
            #invoice-edit-root tbody tr { background: transparent !important; border-bottom: none !important; }
            #invoice-edit-root tbody tr:hover { background: transparent !important; }
          `}</style>

          {/* Title */}
          <table style={tbl}><tbody><tr>
            <td style={{ ...td, textAlign: "center", fontWeight: "bold", fontSize: 14, padding: "7px", letterSpacing: "0.08em" }}>EXPORT INVOICE</td>
          </tr></tbody></table>

          {/* Exporter + Invoice meta */}
          <table style={{ ...tbl, tableLayout: "fixed" }}>
            <colgroup><col style={{ width: "8%" }}/><col style={{ width: "47%" }}/><col style={{ width: "22%" }}/><col style={{ width: "23%" }}/></colgroup>
            <tbody>
              <tr>
                <td style={td} rowSpan={6}><strong>Exporter<br/>Name &amp; Address</strong></td>
                <td style={{ ...td, fontWeight: "bold" }} rowSpan={6}>
                  From: UNNATI PHARMAX<br/>SHOP NO 181 GURUKRUPA APARTMENT<br/>CENTRAL AVE<br/>LAKADGANJ NAGPUR<br/>MAHARSHTRA 440008
                </td>
                <td style={td}><strong>Invoice No.</strong></td>
                <td style={{ ...td, fontWeight: "bold" }}>{invoice.invoiceNo}</td>
              </tr>
              <tr>
                <td style={td}><strong>Date</strong></td>
                <td style={td}><input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></td>
              </tr>
              <tr>
                <td style={td}>Buyer Reference :</td>
                <td style={td}><input value={remitterName} onChange={e => setRemitterName(e.target.value)} placeholder="Remitter name" /></td>
              </tr>
              <tr>
                <td style={td}>Email</td>
                <td style={td}><input value={email} onChange={e => setEmail(e.target.value)} /></td>
              </tr>
              <tr>
                <td style={td}>Phone</td>
                <td style={td}><input value={phone} onChange={e => setPhone(e.target.value)} /></td>
              </tr>
              <tr><td style={td}></td><td style={td} colSpan={2}></td></tr>
            </tbody>
          </table>

          {/* Consignee + Buyer */}
          <table style={{ ...tbl, tableLayout: "fixed" }}>
            <colgroup><col style={{ width: "8%" }}/><col style={{ width: "27%" }}/><col style={{ width: "20%" }}/><col style={{ width: "45%" }}/></colgroup>
            <tbody>
              <tr>
                <td style={td}><strong>Consignee<br/>Name &amp; Address</strong></td>
                <td style={td}></td>
                <td style={td}><strong>Buyer(If Other than Consignee)</strong></td>
                <td style={tdSm}>As per the Annexure</td>
              </tr>
              <tr>
                <td style={td}><strong>To</strong></td>
                <td style={tdSm}>AS PER PACKING LIST</td>
                <td style={td}>India</td>
                <td style={td}>
                  <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" style={{ fontWeight: "bold" }} />
                  <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address" />
                  <span style={{ display: "flex", gap: 3 }}>
                    <input value={city} onChange={e => setCity(e.target.value)} placeholder="City" style={{ flex: 2 }} />
                    <input value={state} onChange={e => setState(e.target.value)} placeholder="State" style={{ flex: 1.5 }} />
                    <input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="Postal" style={{ flex: 1 }} />
                  </span>
                  <input value={country} onChange={e => setCountry(e.target.value)} placeholder="Country" />
                </td>
              </tr>
              <tr>
                <td style={td}></td>
                <td style={tdSm}>(As per Annexure/Packing List)</td>
                <td style={td}></td><td style={td}></td>
              </tr>
              <tr>
                <td style={td}></td>
                <td style={tdSm}>AS PER PACKING LIST / As per Annexure</td>
                <td style={tdSm} colSpan={2}>Third Party Transfer</td>
              </tr>
              <tr>
                <td style={td}></td>
                <td style={td}>Country of Origin: <strong>INDIA</strong></td>
                <td style={td}>Country of final Destination:</td>
                <td style={tdSm}>AS PER PACKING LIST</td>
              </tr>
            </tbody>
          </table>

          {/* Shipping details */}
          <table style={{ ...tbl, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "10%" }}/><col style={{ width: "14%" }}/><col style={{ width: "11%" }}/><col style={{ width: "14%" }}/>
              <col style={{ width: "22%" }}/><col style={{ width: "15%" }}/><col style={{ width: "14%" }}/>
            </colgroup>
            <tbody>
              <tr>
                <td style={td}><strong>Carriage by Air</strong></td>
                <td style={{ ...td, fontWeight: "bold" }}>
                  <select value={shipmentMode} onChange={e => setShipmentMode(e.target.value)}>
                    {SHIPMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </td>
                <td style={td}>Place of Receipt by</td>
                <td style={tdSm}><span style={{ fontWeight: "bold" }}>Pre-carrier:</span> Mumbai</td>
                <td style={td} colSpan={2}>Terms of Delivery and payment</td>
                <td style={{ ...td, fontWeight: "bold", textAlign: "center" }}>CFR</td>
              </tr>
              <tr>
                <td style={td}><strong>Currency</strong></td>
                <td style={{ ...td, fontWeight: "bold" }}>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}>
                    {["USD","EUR","GBP","INR","AUD","CAD","SGD"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td style={td} colSpan={2}>Port of Loading: <strong>Mumbai</strong></td>
                <td style={tdSm}>END USE CODE : DCX900</td>
                <td style={tdSm} colSpan={2}>NATURE PAYMENT : ADVANCE PAYMENT</td>
              </tr>
              <tr>
                <td style={tdSm} colSpan={2}>Port of Discharge: <strong>AS PER PACKING LIST</strong></td>
                <td style={tdSm} colSpan={2}>Final Destination: <strong>AS PER PACKING LIST</strong></td>
                <td style={td}><strong>EXCHANGE RATE $</strong></td>
                <td style={{ ...td, fontWeight: "bold", textAlign: "right" }} colSpan={2}>
                  <input type="number" min="1" step="0.01" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} style={{ textAlign: "right" }} />
                </td>
              </tr>
              <tr>
                <td style={td} colSpan={4}></td>
                <td style={td}><strong>F.O.B INR</strong></td>
                <td style={{ ...td, fontWeight: "bold", textAlign: "right" }} colSpan={2}>{expFobInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style={td} colSpan={4}></td>
                <td style={td}><strong>C&amp;F AMOUNT INR :</strong></td>
                <td style={{ ...td, fontWeight: "bold", textAlign: "right" }} colSpan={2}>{expCnfInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          {/* Items */}
          <table style={{ ...tbl, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "4%" }}/><col style={{ width: "8%" }}/><col style={{ width: "15%" }}/><col style={{ width: "13%" }}/>
              <col style={{ width: "6%" }}/><col style={{ width: "6%" }}/><col style={{ width: "8%" }}/><col style={{ width: "10%" }}/>
              <col style={{ width: "7%" }}/><col style={{ width: "6%" }}/><col style={{ width: "9%" }}/><col style={{ width: "8%" }}/>
            </colgroup>
            <thead>
              <tr>
                {["#","HS Code","Product Name","Generic Name","Mfd. Date","Exp.Date","Batch","Mfg by","Unit Packing","Unit","Price/unit","TOTAL PRICE"].map(h => (
                  <th key={h} style={{ ...td, fontWeight: "bold", textAlign: "center", fontSize: "8px", background: "#e8e8e8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const unitPrice = Number(item.sellingPrice) || 0;
                const qty       = Number(item.quantity)     || 0;
                const rowTotal  = Math.round(unitPrice * qty * 100) / 100;
                return (
                  <tr key={item.id ?? idx} style={{ textAlign: "center" }}>
                    <td style={td}>{idx + 1}</td>
                    <td style={td}></td>
                    <td style={{ ...td, textAlign: "left" }}>{item.productName}</td>
                    <td style={{ ...td, textAlign: "left" }}>{item.composition ?? ""}</td>
                    <td style={td}></td>
                    <td style={td}></td>
                    <td style={td}></td>
                    <td style={td}></td>
                    <td style={td}>{item.pack ?? ""}</td>
                    <td style={td}>
                      <input
                        type="number" min="1"
                        value={item.quantity}
                        onChange={e => updateItem(idx, "quantity", Number(e.target.value))}
                        style={{ textAlign: "center", fontWeight: "bold" }}
                      />
                    </td>
                    <td style={td}>
                      <input
                        type="number" min="0" step="0.01"
                        value={item.sellingPrice}
                        onChange={e => updateItem(idx, "sellingPrice", Number(e.target.value))}
                        style={{ textAlign: "right" }}
                      />
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: "bold" }}>$ {rowTotal.toFixed(2)}</td>
                  </tr>
                );
              })}
              <tr><td style={{ ...td, height: 10 }} colSpan={12}></td></tr>
            </tbody>
          </table>

          {/* Totals */}
          <table style={{ ...tbl, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "30%" }}/><col style={{ width: "8%" }}/><col style={{ width: "8%" }}/><col style={{ width: "8%" }}/>
              <col style={{ width: "22%" }}/><col style={{ width: "12%" }}/><col style={{ width: "12%" }}/>
            </colgroup>
            <tbody>
              <tr>
                <td style={{ ...td, fontWeight: "bold", fontSize: "9px" }} colSpan={4}>TOTAL NO OF BOX = 1</td>
                <td style={td}></td>
                <td style={{ ...td, fontWeight: "bold", textAlign: "right" }}>TOTAL QTY</td>
                <td style={{ ...td, fontWeight: "bold", textAlign: "center" }}>{totalQty}</td>
              </tr>
              <tr>
                <td style={{ ...td, fontWeight: "bold", textAlign: "center" }}>LP</td>
                <td style={{ ...td, fontWeight: "bold", textAlign: "center" }}>EMS</td>
                <td style={{ ...td, fontWeight: "bold", textAlign: "center" }}>CM</td>
                <td style={td}></td><td style={td}></td>
                <td style={td}><strong>Total (FOB)</strong></td>
                <td style={{ ...td, fontWeight: "bold", textAlign: "right" }}>$ {expFobUsd.toFixed(2)}</td>
              </tr>
              <tr>
                <td style={tdSm} colSpan={3}>Total article Qty</td>
                <td style={{ ...td, textAlign: "center", fontWeight: "bold" }}>{totalQty}</td>
                <td style={{ ...td, fontWeight: "bold", textAlign: "center" }}>{currency}</td>
                <td style={td}><strong>Shipping Charges</strong></td>
                <td style={td}>
                  <input type="number" min="0" step="0.01" value={shippingPrice} onChange={e => setShippingPrice(e.target.value)} style={{ textAlign: "right", fontWeight: "bold" }} />
                </td>
              </tr>
              <tr>
                <td style={td} colSpan={5}></td>
                <td style={td}><strong>Total Amount (C &amp; F)</strong></td>
                <td style={td}>
                  <input type="number" min="0" step="0.01" value={dollarAmount} onChange={e => setDollarAmount(e.target.value)} style={{ textAlign: "right", fontWeight: "bold" }} placeholder="0.00" />
                </td>
              </tr>
            </tbody>
          </table>

          {/* Footer */}
          <table style={{ ...tbl, tableLayout: "fixed" }}>
            <colgroup><col style={{ width: "35%" }}/><col style={{ width: "45%" }}/><col style={{ width: "20%" }}/></colgroup>
            <tbody>
              <tr>
                <td style={{ ...tdSm, lineHeight: "1.7" }}>
                  <strong>DL NO. MH-NG2-526036, MH-NAG-526037</strong><br/>
                  IEC Code / PAN &nbsp;<strong>FNXPP3883B</strong><br/>
                  Bank A/C No.: <strong>146305501090</strong><br/>
                  Bank Name : <strong>ICICI BANK</strong><br/>
                  Swift Code : <strong>ICICINBBXXX</strong><br/>
                  GSTIN No : <strong>27FNXPP3883B1ZA</strong><br/>
                  1. Supply meant for export on payment of integrated tax<br/>
                  2. Supply meant for export under bond or LUT without payment of integrated tax.
                </td>
                <td style={{ ...tdSm, lineHeight: "1.6" }}>
                  <strong>Declaration:</strong><br/>
                  We declare that this Invoice shows actual price of goods described and that all particulars are true and correct.<br/><br/>
                  &ldquo;As per the regulatory requirements of importing countries as per specific needs&rdquo;
                </td>
                <td style={{ ...td, textAlign: "center", verticalAlign: "bottom", paddingBottom: 6 }}>
                  <br/><br/><br/>
                  <strong>Authorised Signatory</strong><br/>
                  <strong>UNNATI PHARMAX</strong>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── Below-invoice auxiliary fields ── */}
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: "initial", fontFamily: "initial" }}>

            {/* Tracking & License */}
            <div style={{ border: "1px solid #d1d5db", padding: 12, borderRadius: 6, background: "#fafafa" }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: "#374151", marginBottom: 8, paddingBottom: 5, borderBottom: "1px solid #e5e7eb" }}>Tracking &amp; License</div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: "block", fontSize: 10, color: "#6b7280", marginBottom: 3 }}>Tracking Number</label>
                <input value={trackingNo} onChange={e => setTrackingNo(e.target.value)} placeholder="Postal tracking ID" style={{ ...auxInput, fontFamily: "monospace" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, color: "#6b7280", marginBottom: 3 }}>Drug License No.</label>
                <input value={licenseNo} onChange={e => setLicenseNo(e.target.value)} placeholder="DL-XXXX" style={{ ...auxInput, fontFamily: "monospace" }} />
              </div>
            </div>

            {/* Payment & Notes */}
            <div style={{ border: "1px solid #d1d5db", padding: 12, borderRadius: 6, background: "#fafafa" }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: "#374151", marginBottom: 8, paddingBottom: 5, borderBottom: "1px solid #e5e7eb" }}>Payment &amp; Notes</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "#6b7280", marginBottom: 3 }}>Amount Paid</label>
                  <input type="number" min="0" step="0.01" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} style={{ ...auxInput, fontFamily: "monospace" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "#6b7280", marginBottom: 3 }}>INR Amount</label>
                  <input type="number" min="0" step="0.01" value={inrAmount} onChange={e => setInrAmount(e.target.value)} style={{ ...auxInput, fontFamily: "monospace" }} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, color: "#6b7280", marginBottom: 3 }}>Notes</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes…" style={auxInput} />
              </div>
            </div>
          </div>

          {/* Dosage reminder */}
          <div style={{ marginTop: 14, border: "1px solid #d1d5db", padding: 12, borderRadius: 6, background: "#fafafa", fontSize: "initial", fontFamily: "initial" }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: "#374151", marginBottom: 8, paddingBottom: 5, borderBottom: "1px solid #e5e7eb" }}>
              💊 Dosage Reminder
              {invoice.dosageReminderSent && <span style={{ marginLeft: 10, fontSize: 10, color: "#059669", fontWeight: 400 }}>✅ Reminder already sent on {invoice.dosageReminderDate}</span>}
            </div>
            {dosageSuccess && <div style={{ marginBottom: 8, padding: "5px 8px", background: "#d1fae5", borderRadius: 4, fontSize: 11, color: "#065f46" }}>{dosageSuccess}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
              <div>
                <label style={{ display: "block", fontSize: 10, color: "#6b7280", marginBottom: 3 }}>Total Dosages Ordered</label>
                <input type="number" min="1" value={totalDosages} onChange={e => setTotalDosages(e.target.value)} placeholder="e.g. 30" style={auxInput} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, color: "#6b7280", marginBottom: 3 }}>Dosages Per Day</label>
                <input type="number" min="1" value={dosagePerDay} onChange={e => setDosagePerDay(e.target.value)} placeholder="e.g. 1" style={auxInput} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, color: "#6b7280", marginBottom: 3 }}>Medication Start Date</label>
                <input type="date" value={dosageStartDate} onChange={e => setDosageStartDate(e.target.value)} style={auxInput} />
              </div>
              <button onClick={saveDosage} disabled={dosageSaving || !dosagePerDay || !totalDosages}
                style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", whiteSpace: "nowrap", alignSelf: "end" }}>
                {dosageSaving ? "Saving…" : "Save Dosage"}
              </button>
            </div>
            {daysSupply > 0 && (
              <div style={{ marginTop: 8, display: "flex", gap: 16, fontSize: 11, color: "#374151" }}>
                <span>Supply: <strong>{daysSupply} days</strong></span>
                <span>Reminder: <strong>7 days before run-out</strong></span>
                <span>Reminder date: <strong>{previewReminderDate() ?? "—"}</strong></span>
              </div>
            )}
          </div>
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

      {editing && (
        <InvoiceInlineEditor
          invoice={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { load(search); }}
        />
      )}
    </div>
  );
}
