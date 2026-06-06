"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import PurchaseBillPanel from "./PurchaseBillPanel";
import SupplierSuggestions from "./SupplierSuggestions";
import PackagePhotos from "./PackagePhotos";

// ── Types ────────────────────────────────────────────────────────────────────
type Item = {
  productId: string;
  productName: string;
  composition: string | null;
  manufacturer: string | null;
  hsn: string | null;
  pack: string | null;
  gstPercent: number | null;
  batchNo: string | null;
  mfgDate: string | null;
  expDate: string | null;
  quantity: number;
  sellingPrice: number;
  latestRate: number | null;   // purchase rate in INR per unit
  inrUnit: number | null;      // purchase rate + 15% margin
  amount: number | null;
  stockQty: number | null;     // current stock from Product master
};

type Order = {
  id: string;
  accountId: string | null;   // null = individual link-based client; non-null = account/bulk client
  invoiceNo: string | null;
  invoiceGeneratedAt: string | null;
  status: string;
  fullName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  remitterName: string;
  amountPaid: number;
  currency: string;
  exchangeRate: number;
  dollarAmount: number | null;
  inrAmount: number | null;
  createdAt: string;
  shipmentMode: string | null;
  shippingPrice: number;
  trackingNo: string | null;
  licenseNo: string | null;
  netWeight: number | null;
  grossWeight: number | null;
  prescriptionFileName: string | null;
  items: Item[];
  totalInr: number;
  totalUsd: number | null;
};

// CN22 label field overrides — collected per-order before/after invoice generation
type LabelOverrides = {
  desc:     string;
  value:    string;
  currency: string;
  hsn:      string;
};

// ── Utils ────────────────────────────────────────────────────────────────────
function getInvoiceDate(order: Order): Date {
  // ✅ Use invoiceGeneratedAt as requested; fallback to createdAt; fallback to now
  const s = order.invoiceGeneratedAt ?? order.createdAt ?? null;
  const d = s ? new Date(s) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatDateLongIN(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    PAYMENT_VERIFIED: "badge-green",
    PACKING: "badge-amber",
  };
  return <span className={`badge ${map[s] ?? "badge-gray"}`}>{s.replace("_", " ")}</span>;
}

// ── DOC 1: Export Invoice ─────────────────────────────────────────────────────
function GSTInvoiceDoc({ order, stampB64, sigB64 }: { order: Order; stampB64?: string; sigB64?: string }) {
  const invDate  = getInvoiceDate(order);
  const dateStr  = invDate.toLocaleDateString("en-GB");
  const exchRate = order.exchangeRate || 84;
  const totalUsd = order.dollarAmount ?? 0;

  function d2w(n: number): string {
    const ones = ["","ONE","TWO","THREE","FOUR","FIVE","SIX","SEVEN","EIGHT","NINE","TEN","ELEVEN","TWELVE","THIRTEEN","FOURTEEN","FIFTEEN","SIXTEEN","SEVENTEEN","EIGHTEEN","NINETEEN"];
    const tens = ["","","TWENTY","THIRTY","FORTY","FIFTY","SIXTY","SEVENTY","EIGHTY","NINETY"];
    if (n <= 0) return "ZERO";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " "+ones[n%10] : "");
    if (n < 1000) return ones[Math.floor(n/100)]+" HUNDRED"+(n%100?" "+d2w(n%100):"");
    return d2w(Math.floor(n/1000))+" THOUSAND"+(n%1000?" "+d2w(n%1000):"");
  }
  const dollars  = Math.floor(totalUsd);
  const cents    = Math.round((totalUsd - dollars) * 100);
  const usdWords = d2w(dollars) + " DOLLAR" + (cents > 0 ? " AND "+d2w(cents)+" CENTS" : "");

  function itemUnitUsd(item: Item): number {
    if (item.sellingPrice > 0) return item.sellingPrice;
    return item.inrUnit != null ? item.inrUnit / exchRate : 0;
  }

  return (
    <div id="exp-inv" style={{ fontFamily: "Arial,sans-serif", fontSize: "9.5pt", color: "#000", background: "#fff", padding: "10px" }}>
      <style>{`
        #exp-inv, #exp-inv * { box-sizing: border-box; color: #000 !important; -webkit-text-fill-color: #000 !important; font-family: Arial, sans-serif; }
        #exp-inv { background: #fff !important; }
        #exp-inv table { width: 100%; border-collapse: collapse; }
        #exp-inv td, #exp-inv th { border: 1px solid #000 !important; padding: 4px 6px; vertical-align: top; }
        #exp-inv thead th { background: #d9d9d9 !important; font-weight: 700; text-align: center; font-size: 8.5pt; padding: 5px 4px; }
        #exp-inv .banner td { background: #e8e8e8 !important; font-weight: 800; text-align: center; font-size: 10.5pt; letter-spacing: 0.08em; padding: 6px; }
        #exp-inv .total-row td { background: #d9d9d9 !important; font-weight: 800; }
        #exp-inv .footer-right { text-align: center; }
        #exp-inv .stamp-box { border: 1px solid #000 !important; min-height: 60px; display: flex; align-items: center; justify-content: center; font-size: 8pt; color: #555 !important; margin: 6px 0; }
        #exp-inv .sig-line { border-top: 1px solid #000 !important; padding-top: 4px; font-weight: 700; font-size: 8pt; }
        #exp-inv .meta-table td { border: none !important; padding: 2px 4px; font-size: 8.5pt; }
        #exp-inv .meta-table td:first-child { font-weight: 700; white-space: nowrap; width: 38%; }
        #exp-inv .inner-meta td { border: none !important; padding: 2px 3px; font-size: 8pt; }
        #exp-inv .inner-meta td:first-child { font-weight: 700; white-space: nowrap; }
      `}</style>

      {/* ── Row 1: Header ── */}
      <table style={{ marginBottom: "-1px" }}>
        <tbody>
          <tr>
            {/* Left: Logo + Company */}
            <td style={{ width: "55%", padding: "8px 10px", verticalAlign: "middle" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Unnati" style={{ height: 56, width: "auto", objectFit: "contain" }} />
                <div>
                  <div style={{ fontWeight: 900, fontSize: "13pt", letterSpacing: "0.04em" }}>UNNATI PHARMAX</div>
                  <div style={{ fontSize: "7.5pt", lineHeight: 1.6, marginTop: 3 }}>
                    GROUND FLOOR, HOUSE NO 307/4, GURU VANDANA APARTMENT,<br />
                    KAKASAHEB CHOLKAR MARG, LAKADGANJ, NAGPUR – 440008, MAHARASHTRA<br />
                    GSTIN: 27FNXPP3883B1ZA &nbsp;|&nbsp; IEC: FNXPP3883B &nbsp;|&nbsp; Drug Lic: MH-NB-152878
                  </div>
                </div>
              </div>
            </td>
            {/* Right: EXPORT INVOICE title + meta */}
            <td style={{ width: "45%", padding: "8px 10px", verticalAlign: "top" }}>
              <div style={{ fontWeight: 900, fontSize: "14pt", textAlign: "center", letterSpacing: "0.1em", marginBottom: 8, borderBottom: "2px solid #000", paddingBottom: 4 }}>
                EXPORT INVOICE
              </div>
              <table className="meta-table" style={{ width: "100%" }}>
                <tbody>
                  <tr><td>Invoice No.</td><td style={{ fontWeight: 800, fontSize: "9.5pt" }}>{order.invoiceNo ?? "—"}</td></tr>
                  <tr><td>Date</td><td>{dateStr}</td></tr>
                  <tr><td>Tracking No.</td><td>{order.trackingNo ?? "—"}</td></tr>
                  <tr><td>Mode of Shipment</td><td>{order.shipmentMode ?? "EMS"}</td></tr>
                  <tr><td>Exchange Rate</td><td>1 USD = ₹{exchRate}</td></tr>
                  <tr><td>Port of Loading</td><td>Mumbai, India</td></tr>
                  <tr><td>Port of Discharge</td><td>{order.country}</td></tr>
                  <tr><td>IEC Code</td><td>FNXPP3883B</td></tr>
                  <tr><td>LUT No.</td><td>AD271023037544C</td></tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Row 2: Consignee / Buyer ── */}
      <table style={{ marginBottom: "-1px" }}>
        <tbody>
          <tr>
            <td style={{ width: "55%", minHeight: 90, padding: "6px 10px" }}>
              <div style={{ fontWeight: 700, fontSize: "8pt", marginBottom: 5, textDecoration: "underline" }}>CONSIGNEE :</div>
              <div style={{ fontWeight: 800, fontSize: "9.5pt" }}>{order.fullName}</div>
              <div>{order.address}</div>
              {(order.city || order.state) && <div>{[order.city, order.state].filter(Boolean).join(", ")} {order.postalCode}</div>}
              <div style={{ fontWeight: 700 }}>{order.country}</div>
            </td>
            <td style={{ width: "45%", minHeight: 90, padding: "6px 10px" }}>
              <div style={{ fontWeight: 700, fontSize: "8pt", marginBottom: 5, textDecoration: "underline" }}>BUYER (If other than consignee) :</div>
              {order.remitterName && <div style={{ fontWeight: 700 }}>{order.remitterName}</div>}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Banner ── */}
      <table className="banner" style={{ marginBottom: "-1px" }}>
        <tbody><tr><td>INDIAN PHARMACEUTICAL MEDICINES</td></tr></tbody>
      </table>

      {/* ── Product Table ── */}
      <table style={{ marginBottom: "-1px" }}>
        <thead>
          <tr>
            <th style={{ width: "4%" }}>Sr.<br />No.</th>
            <th style={{ textAlign: "left", minWidth: 100 }}>PRODUCT</th>
            <th style={{ width: "8%" }}>PACK</th>
            <th style={{ width: "8%" }}>HSN</th>
            <th style={{ width: "5%" }}>QTY</th>
            <th style={{ width: "10%" }}>Batch No.</th>
            <th style={{ width: "6%" }}>MFG</th>
            <th style={{ width: "6%" }}>EXP</th>
            <th style={{ width: "8%", textAlign: "right" }}>SR.B<br />(USD)</th>
            <th style={{ width: "10%", textAlign: "right" }}>AMOUNT<br />US $</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, idx) => {
            const unitUsd   = itemUnitUsd(item);
            const amountUsd = unitUsd * item.quantity;
            return (
              <tr key={item.productId}>
                <td style={{ textAlign: "center" }}>{idx + 1}</td>
                <td>
                  <div style={{ fontWeight: 700 }}>{item.productName}</div>
                  {item.composition  && <div style={{ fontSize: "7pt" }}>{item.composition}</div>}
                  {item.manufacturer && <div style={{ fontSize: "7pt", color: "#444" }}>{item.manufacturer}</div>}
                </td>
                <td style={{ textAlign: "center", fontSize: "8pt" }}>{item.pack ?? ""}</td>
                <td style={{ textAlign: "center", fontFamily: "monospace", fontSize: "8pt" }}>{item.hsn ?? ""}</td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>{item.quantity}</td>
                <td style={{ textAlign: "center", fontFamily: "monospace", fontSize: "8pt" }}>{item.batchNo ?? ""}</td>
                <td style={{ textAlign: "center", fontSize: "8pt" }}>{item.mfgDate ?? ""}</td>
                <td style={{ textAlign: "center", fontSize: "8pt" }}>{item.expDate ?? ""}</td>
                <td style={{ textAlign: "right" }}>{unitUsd > 0 ? unitUsd.toFixed(2) : ""}</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{amountUsd > 0 ? amountUsd.toFixed(2) : ""}</td>
              </tr>
            );
          })}
          {order.items.length < 6 && Array.from({ length: 6 - order.items.length }).map((_, i) => (
            <tr key={`filler-${i}`}>
              {Array.from({ length: 10 }).map((_, j) => <td key={j} style={{ height: 22 }}>&nbsp;</td>)}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <td colSpan={9} style={{ textAlign: "right", fontSize: "9.5pt" }}>TOTAL PRODUCT VALUE</td>
            <td style={{ textAlign: "right", fontSize: "9.5pt" }}>{totalUsd.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      {/* ── Footer ── */}
      <table>
        <tbody>
          <tr>
            {/* Left: weights, amount in words, declaration */}
            <td style={{ width: "65%", fontSize: "8.5pt", padding: "8px 10px" }}>
              <div style={{ marginBottom: 6, fontSize: "9pt" }}>
                <strong>GMS NET WT :</strong>&nbsp;
                {order.netWeight != null ? (order.netWeight * 1000).toFixed(0) : "________"}
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                <strong>GMS NET NET WT :</strong>&nbsp;
                {order.grossWeight != null ? (order.grossWeight * 1000).toFixed(0) : "________"}
              </div>
              <div style={{ marginBottom: 8, fontSize: "8.5pt" }}>
                <strong>DOLLAR in Words :</strong>&nbsp;{usdWords}
              </div>
              <div style={{ fontSize: "7.5pt", lineHeight: 1.7, borderTop: "1px solid #000", paddingTop: 6 }}>
                <strong>Declaration :</strong> We declare that this Invoice shows the actual price of the goods
                described and that all particulars are true and correct. Supply meant for export under
                Letter of Undertaking (LUT) without payment of IGST. The goods are of Indian Origin and
                are permitted for export from India.
              </div>
            </td>
            {/* Right: FOR VALUE + stamp + signatory */}
            <td style={{ width: "35%", padding: "8px 10px", verticalAlign: "top" }} className="footer-right">
              <div style={{ fontSize: "9pt", fontWeight: 700, marginBottom: 2 }}>FOR VALUE</div>
              <div style={{ fontSize: "13pt", fontWeight: 900, marginBottom: 12 }}>
                USD &nbsp;{totalUsd.toFixed(2)}
              </div>
              {stampB64
                ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={stampB64} alt="Stamp" style={{ maxHeight: 72, maxWidth: "100%", objectFit: "contain", margin: "6px 0", display: "block" }} />
                : <div className="stamp-box">COMPANY STAMP</div>
              }
              {sigB64
                ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={sigB64} alt="Signature" style={{ maxHeight: 44, maxWidth: "100%", objectFit: "contain", marginBottom: 2, display: "block" }} />
                : <div style={{ height: 36 }} />
              }
              <div className="sig-line">Authorised Signatory</div>
              <div style={{ fontSize: "8pt", fontWeight: 700, marginTop: 2 }}>For UNNATI PHARMAX</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── DOC 1b: New Export Invoice (matches HTML template format) ─────────────────
function ExportInvoiceDoc({ order }: { order: Order }) {
  const invDate    = getInvoiceDate(order);
  const exchRate   = order.exchangeRate || 84;
  const expCnfUsd  = order.dollarAmount ?? 0;
  const expShipUsd = order.shippingPrice;
  const expFobUsd  = Math.max(0, expCnfUsd - expShipUsd);
  const totalItemInr = order.items.reduce((s, i) => s + (i.amount ?? 0), 0);
  const totalQty     = order.items.reduce((s, i) => s + i.quantity, 0);
  const expFobInr    = Math.round(expFobUsd * exchRate * 100) / 100;
  const expCnfInr    = Math.round(expCnfUsd * exchRate * 100) / 100;
  const dateStr      = invDate.toLocaleDateString("en-GB").replaceAll("/", ".");
  const cityLine     = [order.city, order.state].filter(Boolean).join(", ") + " " + order.postalCode;

  function itemUsd(item: Item) {
    // Priority: proportional from INR totals → inrUnit/rate → sellingPrice (which is in USD) → 0
    const rawTotal = totalItemInr > 0 && expFobUsd > 0
      ? (item.amount ?? 0) / totalItemInr * expFobUsd
      : item.inrUnit != null
        ? item.inrUnit * item.quantity / exchRate
        : item.sellingPrice * item.quantity;  // sellingPrice stored in order currency (USD)
    const total = Math.round(rawTotal * 100) / 100;
    return { total, unit: item.quantity > 0 ? Math.round(total / item.quantity * 100) / 100 : 0 };
  }

  const td:   React.CSSProperties = { border: "1px solid #000", padding: "3px 5px", verticalAlign: "top", fontSize: "9px" };
  const tdSm: React.CSSProperties = { ...td, fontSize: "8px" };
  const yw:   React.CSSProperties = { ...td };
  const tbl:  React.CSSProperties = { width: "100%", borderCollapse: "collapse" as const };

  return (
    <div style={{ fontFamily: "Arial,sans-serif", fontSize: "9px", color: "#000", background: "#fff", minWidth: 900 }}>
      {/* Title */}
      <table style={tbl}><tbody><tr>
        <td style={{ ...td, textAlign: "center", fontWeight: "bold", fontSize: "14px", padding: "7px", letterSpacing: "0.08em" }}>EXPORT INVOICE</td>
      </tr></tbody></table>

      {/* Exporter + Invoice details */}
      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup><col style={{ width: "8%" }}/><col style={{ width: "47%" }}/><col style={{ width: "22%" }}/><col style={{ width: "23%" }}/></colgroup>
        <tbody>
          <tr>
            <td style={td} rowSpan={6}><strong>Exporter<br/>Name &amp; Address</strong></td>
            <td style={{ ...td, fontWeight: "bold" }} rowSpan={6}>
              From: UNNATI PHARMAX<br/>SHOP NO 181 GURUKRUPA APARTMENT<br/>CENTRAL AVE<br/>LAKADGANJ NAGPUR<br/>MAHARSHTRA 440008
            </td>
            <td style={td}><strong>Invoice No.</strong></td>
            <td style={{ ...yw, fontWeight: "bold" }}>{order.invoiceNo ?? "—"}</td>
          </tr>
          <tr><td style={td}><strong>Date</strong></td><td style={yw}>{dateStr}</td></tr>
          <tr><td style={td}>Buyer Reference :</td><td style={yw}>{order.remitterName}</td></tr>
          <tr><td style={td}>Email Order</td><td style={yw}></td></tr>
          <tr><td style={td}>Other Reference:</td><td style={yw}></td></tr>
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
            <td style={{ ...yw, fontWeight: "bold" }}>{order.fullName}<br/>{order.address}<br/>{cityLine.trim()}<br/>{order.country}</td>
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

      {/* Shipping */}
      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup><col style={{ width: "10%" }}/><col style={{ width: "14%" }}/><col style={{ width: "11%" }}/><col style={{ width: "14%" }}/><col style={{ width: "22%" }}/><col style={{ width: "15%" }}/><col style={{ width: "14%" }}/></colgroup>
        <tbody>
          <tr>
            <td style={td}><strong>Carriage by Air</strong></td>
            <td style={{ ...yw, fontWeight: "bold" }}>{order.shipmentMode ?? "EMS"}</td>
            <td style={td}>Place of Receipt by</td>
            <td style={tdSm}><span style={{ fontWeight: "bold" }}>Pre-carrier:</span> Mumbai</td>
            <td style={td} colSpan={2}>Terms of Delivery and payment</td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>CFR</td>
          </tr>
          <tr>
            <td style={td}><strong>Currency</strong></td>
            <td style={{ ...yw, fontWeight: "bold" }}>{order.currency}</td>
            <td style={td} colSpan={2}>Port of Loading: <strong>Mumbai</strong></td>
            <td style={tdSm}>END USE CODE : DCX900</td>
            <td style={tdSm} colSpan={2}>NATURE PAYMENT : ADVANCE PAYMENT</td>
          </tr>
          <tr>
            <td style={tdSm} colSpan={2}>Port of Discharge: <strong>AS PER PACKING LIST</strong></td>
            <td style={tdSm} colSpan={2}>Final Destination: <strong>AS PER PACKING LIST</strong></td>
            <td style={td}><strong>EXCHANGE RATE $</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }} colSpan={2}>{exchRate.toFixed(2)}</td>
          </tr>
          <tr>
            <td style={td} colSpan={4}></td>
            <td style={td}><strong>F.O.B INR</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }} colSpan={2}>{expFobInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style={td} colSpan={4}></td>
            <td style={td}><strong>C&amp;F AMOUNT INR :</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }} colSpan={2}>{expCnfInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      {/* Items */}
      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "4%" }}/><col style={{ width: "8%" }}/><col style={{ width: "13%" }}/><col style={{ width: "12%" }}/>
          <col style={{ width: "6%" }}/><col style={{ width: "6%" }}/><col style={{ width: "8%" }}/><col style={{ width: "12%" }}/>
          <col style={{ width: "7%" }}/><col style={{ width: "5%" }}/><col style={{ width: "9%" }}/><col style={{ width: "10%" }}/>
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }}>Marks &amp; Nos</th>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }} colSpan={8}>Description of Goods</th>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }}>Unit</th>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }}>Price/unit</th>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }}>TOTAL PRICE</th>
          </tr>
          <tr>
            {["#","HS Code","Product Name","Generic Name","Mfd. Date","Exp.Date","Batch","Mfg by","Unit Packing","Unit","Price/unit","TOTAL PRICE"].map(h => (
              <th key={h} style={{ ...td, fontWeight: "bold", textAlign: "center", fontSize: "8px", background: "#ececec" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, idx) => {
            const { unit, total } = itemUsd(item);
            return (
              <tr key={idx} style={{ textAlign: "center" }}>
                <td style={td}>{idx + 1}</td>
                <td style={td}>{item.hsn ?? ""}</td>
                <td style={{ ...td, textAlign: "left" }}>{item.productName}</td>
                <td style={{ ...td, textAlign: "left" }}>{item.composition ?? ""}</td>
                <td style={td}>{item.mfgDate ?? ""}</td>
                <td style={td}>{item.expDate ?? ""}</td>
                <td style={td}>{item.batchNo ?? ""}</td>
                <td style={{ ...td, textAlign: "left" }}>{item.manufacturer ?? ""}</td>
                <td style={td}>{item.pack ?? ""}</td>
                <td style={{ ...td, fontWeight: "bold" }}>{item.quantity}</td>
                <td style={{ ...td, textAlign: "right" }}>$ {unit.toFixed(2)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: "bold" }}>$ {total.toFixed(2)}</td>
              </tr>
            );
          })}
          <tr><td style={{ ...td, height: "10px" }} colSpan={12}></td></tr>
        </tbody>
      </table>

      {/* Totals */}
      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup><col style={{ width: "30%" }}/><col style={{ width: "8%" }}/><col style={{ width: "8%" }}/><col style={{ width: "8%" }}/><col style={{ width: "22%" }}/><col style={{ width: "12%" }}/><col style={{ width: "12%" }}/></colgroup>
        <tbody>
          <tr>
            <td style={{ ...yw, fontWeight: "bold", fontSize: "9px" }} colSpan={4}>TOTAL NO OF BOX = 1</td>
            <td style={td}></td>
            <td style={{ ...td, fontWeight: "bold", textAlign: "right" }}>TOTAL QTY</td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>{totalQty}</td>
          </tr>
          <tr>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>LP</td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>EMS</td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>CM</td>
            <td style={td}></td><td style={td}></td>
            <td style={td}><strong>Total (FOB)</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }}>$ {expFobUsd.toFixed(2)}</td>
          </tr>
          <tr>
            <td style={tdSm} colSpan={3}>Total article Qty</td>
            <td style={{ ...yw, textAlign: "center", fontWeight: "bold" }}>{totalQty}</td>
            <td style={{ ...td, fontWeight: "bold", textAlign: "center" }}>{order.currency}</td>
            <td style={td}><strong>Shipping Charges</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }}>$ {expShipUsd.toFixed(2)}</td>
          </tr>
          <tr>
            <td style={td} colSpan={5}></td>
            <td style={td}><strong>Total Amount (C &amp; F)</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }}>$ {expCnfUsd.toFixed(2)}</td>
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
            <td style={{ ...td, textAlign: "center", verticalAlign: "bottom", paddingBottom: "6px" }}>
              <br/><br/><br/>
              <strong>Authorised Signatory</strong><br/>
              <strong>UNNATI PHARMAX</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── DOC 1c: Export Invoice — INR format ──────────────────────────────────────
function ExportInvoiceINRDoc({ order }: { order: Order }) {
  const invDate    = getInvoiceDate(order);
  const exchRate   = order.exchangeRate || 84;
  const dateStr    = invDate.toLocaleDateString("en-GB").replaceAll("/", ".");
  const cityLine   = [order.city, order.state].filter(Boolean).join(", ") + " " + order.postalCode;

  // C&F total in INR — prefer recorded inrAmount, fall back to dollarAmount × rate
  const expCnfInr  = (order.inrAmount != null && order.inrAmount > 0)
    ? order.inrAmount
    : Math.round((order.dollarAmount ?? 0) * exchRate * 100) / 100;
  // Shipping in INR (shippingPrice stored in USD)
  const expShipInr = Math.round(order.shippingPrice * exchRate * 100) / 100;
  const expFobInr  = Math.max(0, expCnfInr - expShipInr);
  const totalQty   = order.items.reduce((s, i) => s + i.quantity, 0);

  // Per-item INR amounts: prefer item.amount → inrUnit × qty → sellingPrice × rate × qty
  function itemInr(item: Item): { unit: number; total: number } {
    let total: number;
    if (item.amount != null && item.amount > 0) {
      total = item.amount;
    } else if (item.inrUnit != null) {
      total = Math.round(item.inrUnit * item.quantity * 100) / 100;
    } else {
      total = Math.round(item.sellingPrice * exchRate * item.quantity * 100) / 100;
    }
    total = Math.round(total * 100) / 100;
    const unit = item.quantity > 0 ? Math.round(total / item.quantity * 100) / 100 : 0;
    return { total, unit };
  }

  const td:   React.CSSProperties = { border: "1px solid #000", padding: "3px 5px", verticalAlign: "top", fontSize: "9px" };
  const tdSm: React.CSSProperties = { ...td, fontSize: "8px" };
  const yw:   React.CSSProperties = { ...td };
  const tbl:  React.CSSProperties = { width: "100%", borderCollapse: "collapse" as const };

  return (
    <div style={{ fontFamily: "Arial,sans-serif", fontSize: "9px", color: "#000", background: "#fff", minWidth: 900 }}>
      {/* Title */}
      <table style={tbl}><tbody><tr>
        <td style={{ ...td, textAlign: "center", fontWeight: "bold", fontSize: "14px", padding: "7px", letterSpacing: "0.08em" }}>EXPORT INVOICE</td>
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
            <td style={{ ...yw, fontWeight: "bold" }}>{order.invoiceNo ?? "—"}</td>
          </tr>
          <tr><td style={td}><strong>Date</strong></td><td style={yw}>{dateStr}</td></tr>
          <tr><td style={td}>Buyer Reference :</td><td style={yw}>{order.remitterName}</td></tr>
          <tr><td style={td}>Email Order</td><td style={yw}></td></tr>
          <tr><td style={td}>Other Reference:</td><td style={yw}></td></tr>
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
            <td style={{ ...yw, fontWeight: "bold" }}>{order.fullName}<br/>{order.address}<br/>{cityLine.trim()}<br/>{order.country}</td>
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

      {/* Shipping */}
      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "10%" }}/><col style={{ width: "14%" }}/><col style={{ width: "11%" }}/><col style={{ width: "14%" }}/>
          <col style={{ width: "22%" }}/><col style={{ width: "15%" }}/><col style={{ width: "14%" }}/>
        </colgroup>
        <tbody>
          <tr>
            <td style={td}><strong>Carriage by Air</strong></td>
            <td style={{ ...yw, fontWeight: "bold" }}>{order.shipmentMode ?? "EMS"}</td>
            <td style={td}>Place of Receipt by</td>
            <td style={tdSm}><span style={{ fontWeight: "bold" }}>Pre-carrier:</span> Mumbai</td>
            <td style={td} colSpan={2}>Terms of Delivery and payment</td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>CFR</td>
          </tr>
          <tr>
            <td style={td}><strong>Currency</strong></td>
            <td style={{ ...yw, fontWeight: "bold" }}>INR</td>
            <td style={td} colSpan={2}>Port of Loading: <strong>Mumbai</strong></td>
            <td style={tdSm}>END USE CODE : DCX900</td>
            <td style={tdSm} colSpan={2}>NATURE PAYMENT : ADVANCE PAYMENT</td>
          </tr>
          <tr>
            <td style={tdSm} colSpan={2}>Port of Discharge: <strong>AS PER PACKING LIST</strong></td>
            <td style={tdSm} colSpan={2}>Final Destination: <strong>AS PER PACKING LIST</strong></td>
            <td style={td}><strong>EXCHANGE RATE $</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }} colSpan={2}>{exchRate.toFixed(2)}</td>
          </tr>
          <tr>
            <td style={td} colSpan={4}></td>
            <td style={td}><strong>F.O.B INR</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }} colSpan={2}>{expFobInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style={td} colSpan={4}></td>
            <td style={td}><strong>C&amp;F AMOUNT INR :</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }} colSpan={2}>{expCnfInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      {/* Items */}
      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "4%" }}/><col style={{ width: "8%" }}/><col style={{ width: "13%" }}/><col style={{ width: "12%" }}/>
          <col style={{ width: "6%" }}/><col style={{ width: "6%" }}/><col style={{ width: "8%" }}/><col style={{ width: "12%" }}/>
          <col style={{ width: "7%" }}/><col style={{ width: "5%" }}/><col style={{ width: "10%" }}/><col style={{ width: "9%" }}/>
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }}>Marks &amp; Nos</th>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }} colSpan={8}>Description of Goods</th>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }}>Unit</th>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }}>Price/unit</th>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }}>TOTAL PRICE</th>
          </tr>
          <tr>
            {["#","HS Code","Product Name","Generic Name","Mfd. Date","Exp.Date","Batch","Mfg by","Unit Packing","Unit","Price/unit (₹)","TOTAL PRICE (₹)"].map(h => (
              <th key={h} style={{ ...td, fontWeight: "bold", textAlign: "center", fontSize: "8px", background: "#ececec" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, idx) => {
            const { unit, total } = itemInr(item);
            return (
              <tr key={idx} style={{ textAlign: "center" }}>
                <td style={td}>{idx + 1}</td>
                <td style={td}>{item.hsn ?? ""}</td>
                <td style={{ ...td, textAlign: "left" }}>{item.productName}</td>
                <td style={{ ...td, textAlign: "left" }}>{item.composition ?? ""}</td>
                <td style={td}>{item.mfgDate ?? ""}</td>
                <td style={td}>{item.expDate ?? ""}</td>
                <td style={td}>{item.batchNo ?? ""}</td>
                <td style={{ ...td, textAlign: "left" }}>{item.manufacturer ?? ""}</td>
                <td style={td}>{item.pack ?? ""}</td>
                <td style={{ ...td, fontWeight: "bold" }}>{item.quantity}</td>
                <td style={{ ...td, textAlign: "right" }}>₹ {unit.toFixed(2)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: "bold" }}>₹ {total.toFixed(2)}</td>
              </tr>
            );
          })}
          <tr><td style={{ ...td, height: "10px" }} colSpan={12}></td></tr>
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
            <td style={{ ...yw, fontWeight: "bold", fontSize: "9px" }} colSpan={4}>TOTAL NO OF BOX = 1</td>
            <td style={td}></td>
            <td style={{ ...td, fontWeight: "bold", textAlign: "right" }}>TOTAL QTY</td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>{totalQty}</td>
          </tr>
          <tr>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>LP</td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>EMS</td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>CM</td>
            <td style={td}></td><td style={td}></td>
            <td style={td}><strong>Total (FOB)</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }}>₹ {expFobInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style={tdSm} colSpan={3}>Total article Qty</td>
            <td style={{ ...yw, textAlign: "center", fontWeight: "bold" }}>{totalQty}</td>
            <td style={{ ...td, fontWeight: "bold", textAlign: "center" }}>INR</td>
            <td style={td}><strong>Shipping Charges</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }}>₹ {expShipInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style={td} colSpan={5}></td>
            <td style={td}><strong>Total Amount (C &amp; F)</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }}>₹ {expCnfInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
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
            <td style={{ ...td, textAlign: "center", verticalAlign: "bottom", paddingBottom: "6px" }}>
              <br/><br/><br/>
              <strong>Authorised Signatory</strong><br/>
              <strong>UNNATI PHARMAX</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── DOC 2: Packing List ──────────────────────────────────────────────────────
function PackingListDoc({ order }: { order: Order }) {
  const invDate        = getInvoiceDate(order);
  const dateStr        = invDate.toLocaleDateString("en-GB").replaceAll("/", ".");
  const totalWeightGms = order.netWeight != null ? Math.round(order.netWeight * 1000) : null;

  const BLK = "#000";
  const WHT = "#fff";

  const border = "1px solid #000";
  const base: React.CSSProperties = { border, padding: "3px 5px", verticalAlign: "top", color: BLK, fontSize: "9pt", background: WHT };
  const hdr:  React.CSSProperties = { ...base, fontWeight: "bold" };
  const th:   React.CSSProperties = { ...base, background: "#e8e8e8", fontWeight: "bold", textAlign: "center", fontSize: "8.5pt", verticalAlign: "middle" };
  const td:   React.CSSProperties = { ...base };
  const tdc:  React.CSSProperties = { ...base, textAlign: "center" };
  const tbl:  React.CSSProperties = { width: "100%", borderCollapse: "collapse" as const };

  const COLS = ["Sr No","Customer","Product Name","Mfd. Date","Exp.Date","Batch No.","Mfg by.","Packing","Qty","Country","Zipcode","Tracking No","Weight(IN GMS)"];

  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: "9pt", color: BLK, background: WHT }}>

      {/* ── Company header ── */}
      <table style={tbl}><tbody>
        <tr>
          <td style={{ ...hdr, textAlign: "center", fontSize: "17pt", padding: "6px 8px", letterSpacing: "0.04em" }}>
            UNNATI PHARMAX
          </td>
        </tr>
        <tr>
          <td style={{ ...hdr, textAlign: "center", fontSize: "13pt", padding: "4px 8px", letterSpacing: "0.06em" }}>
            PACKING LIST (Annexure)
          </td>
        </tr>
      </tbody></table>

      {/* ── Meta info (IEC No, Invoice No, Date, GST NO) ── */}
      <table style={tbl}>
        <colgroup>
          <col style={{ width: "12%" }}/><col style={{ width: "22%" }}/>
          <col/><col/><col/><col/>
        </colgroup>
        <tbody>
          {[
            ["IEC No :",    "FNXPP3883B"],
            ["Invoice No:", order.invoiceNo ?? "—"],
            ["Date:",       dateStr],
            ["GST NO :",    "27FNXPP3883B1ZA"],
          ].map(([label, value]) => (
            <tr key={label}>
              <td style={hdr}>{label}</td>
              <td style={td}>{value}</td>
              <td style={td}></td><td style={td}></td><td style={td}></td><td style={td}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Product table ── */}
      <table style={tbl}>
        <colgroup>
          <col style={{ width: "4%" }}/>   {/* Sr No */}
          <col style={{ width: "9%" }}/>   {/* Customer */}
          <col style={{ width: "17%" }}/>  {/* Product Name */}
          <col style={{ width: "7%" }}/>   {/* Mfd. Date */}
          <col style={{ width: "7%" }}/>   {/* Exp.Date */}
          <col style={{ width: "9%" }}/>   {/* Batch No. */}
          <col style={{ width: "14%" }}/>  {/* Mfg by. */}
          <col style={{ width: "6%" }}/>   {/* Packing */}
          <col style={{ width: "4%" }}/>   {/* Qty */}
          <col style={{ width: "8%" }}/>   {/* Country */}
          <col style={{ width: "6%" }}/>   {/* Zipcode */}
          <col style={{ width: "9%" }}/>   {/* Tracking No */}
          <col style={{ width: "10%" }}/>  {/* Weight */}
        </colgroup>
        <thead>
          <tr>{COLS.map(h => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {order.items.map((item, idx) => (
            <tr key={item.productId + idx}>
              {/* Sr No — spans all product rows */}
              {idx === 0 && (
                <td rowSpan={order.items.length} style={{ ...tdc, verticalAlign: "middle" }}>1</td>
              )}
              {/* Customer — spans all product rows */}
              {idx === 0 && (
                <td rowSpan={order.items.length} style={{ ...tdc, verticalAlign: "middle" }}>{order.fullName}</td>
              )}
              {/* Per-product columns */}
              <td style={td}>{item.productName}</td>
              <td style={tdc}>{item.mfgDate ?? ""}</td>
              <td style={tdc}>{item.expDate ?? ""}</td>
              <td style={{ ...tdc, fontFamily: "monospace" }}>{item.batchNo ?? ""}</td>
              <td style={td}>{item.manufacturer ?? ""}</td>
              <td style={tdc}>{item.pack ?? ""}</td>
              <td style={{ ...tdc, fontWeight: "bold" }}>{item.quantity}</td>
              {/* Country / Zipcode / Tracking / Weight — span all rows */}
              {idx === 0 && (
                <td rowSpan={order.items.length} style={{ ...tdc, verticalAlign: "middle" }}>{order.country}</td>
              )}
              {idx === 0 && (
                <td rowSpan={order.items.length} style={{ ...tdc, verticalAlign: "middle", fontFamily: "monospace" }}>{order.postalCode}</td>
              )}
              {idx === 0 && (
                <td rowSpan={order.items.length} style={{ ...tdc, verticalAlign: "middle", fontFamily: "monospace" }}>{order.trackingNo ?? ""}</td>
              )}
              {idx === 0 && (
                <td rowSpan={order.items.length} style={{ ...tdc, verticalAlign: "middle" }}>
                  {totalWeightGms != null ? `${totalWeightGms} GMS` : ""}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── DOC 4: Covering Letter ───────────────────────────────────────────────────
function CoveringLetterDoc({ order, chaName, chaNo }: { order: Order; chaName?: string; chaNo?: string }) {
  const invDate = getInvoiceDate(order);
  const dateStr = invDate.toLocaleDateString("en-GB"); // DD/MM/YYYY
  const invNo   = order.invoiceNo ?? "—";
  const productNames = order.items.map(i => i.productName).join(", ");

  return (
    <div id="covering-letter-print" style={{ fontFamily: "Times New Roman, serif", fontSize: "11pt", color: "#000", padding: "16px 28px", lineHeight: 1.5 }}>
      <style>{`
        #covering-letter-print .hl { background: #fff9c4; }
        @media print { #covering-letter-print { padding: 0; } }
      `}</style>

      {/* Date + Addressee */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div></div>
        <div>Date: <span className="hl"><b>{dateStr}</b></span></div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <b>The Asst. Commissioner of Customs</b><br />
        Postal Appraising Section (PAS), Export Department<br />
        Foreign Post Office, VideshDakBhavan,<br />
        Ballard Piers,<br />
        Mumbai – 400 001
      </div>

      <div style={{ marginBottom: 8 }}>Dear Sir,</div>

      <div style={{ marginBottom: 8 }}>
        We request permission to export, non narcotic drugs/Medicines duly approved by Central
        Drugs Standard Control Organization (CDSCO) &amp; FDA{" "}
        <span className="hl"><b>{productNames}</b></span>{" "}
        Invoice No <span className="hl"><b>{invNo}</b></span>{" "}
        Dated <span className="hl"><b>{dateStr}</b></span>{" "}
        with reference to the Order no{" "}
        <span className="hl"><b>{invNo}</b></span>{" "}
        dated <span className="hl"><b>{dateStr}</b></span>.
      </div>

      <div style={{ marginBottom: 8 }}>
        The drugs/medicines being exported are procured in bulk from licensed manufacturers or
        their stockiest and are manufactured as per the norms notified by CDSCO and FDA.
      </div>

      <div style={{ marginBottom: 8 }}>
        The drugs/medicines are shipped in their original packing to the buyer&apos;s individual clients
        abroad as per the dispatch list forwarded along with the order.
      </div>

      <div style={{ marginBottom: 8 }}>
        The payment is received through our ICICI Bank account. 146305501090 No export
        incentive, benefits or drawback is claimed by us. The following documents are enclosed for
        your kind perusal:-
      </div>

      <ol style={{ marginBottom: 8, paddingLeft: 28 }}>
        <li>Covering Letter</li>
        <li>Invoice (4 Copies)</li>
        <li>Packing List 2 Copies</li>
        <li>IEC Copy &amp; 5 Drug License (20 B &amp; 21 B)</li>
        <li>PBE (2 copy)</li>
      </ol>

      <div style={{ marginBottom: 8 }}>
        We undertake to abide by provisions of Foreign Exchange Management Act 1999, as
        amended from time to time, including realization / repatriation of Foreign Exchange to &amp; from
        India.
      </div>

      <div style={{ marginBottom: 8 }}>
        We trust the same is in order and submit that the above declaration is true and correct and
        the goods exported are not in contravention to any laws in force.
      </div>

      <div style={{ marginBottom: 8 }}>
        We had authorized to <b>{chaName ?? "AARPEE CLEARING & LOGISTICS"} (CHA NO: {chaNo ?? "11/2623"})</b>. We
        undertake that we are responsible for the acts related to above if found violating any Law in
        force.
      </div>

      <div style={{ marginBottom: 4 }}>Thanking you,</div>
      <div style={{ marginBottom: 20 }}>Yours sincerely,</div>

      <div>
        <b>For UNNATI PHARMAX</b><br /><br />
        <b>Authorized Signatory</b>
      </div>
    </div>
  );
}

// ── DOC 5: CN22 Customs Declaration Label ────────────────────────────────────

// Country → label variant mapping (per India Post CN22 specification)
const CN22_EPACKET = new Set([
  "cambodia","indonesia","japan","korea","south korea","new zealand","sri lanka",
]);
const CN22_PRIME = new Set([
  "united states","usa","united states of america","us","canada",
]);
const CN22_TRACK_TRACE = new Set([
  "aruba","belarus","bhutan","bulgaria","chile","china","curacao",
  "dominican republic","egypt","estonia","georgia","gibraltar","hong kong",
  "jersey","kazakhstan","lithuania","malaysia","mexico","morocco","myanmar",
  "netherlands","oman","philippines","singapore","solomon islands","tuvalu",
  "ukraine","united arab emirates","uae","uruguay","vietnam","zimbabwe",
]);

type CN22Variant = "epacket" | "prime" | "track" | "standard";

function getCN22Variant(country: string): CN22Variant {
  const c = (country ?? "").toLowerCase().trim();
  if (CN22_PRIME.has(c))       return "prime";
  if (CN22_EPACKET.has(c))     return "epacket";
  if (CN22_TRACK_TRACE.has(c)) return "track";
  return "standard";
}

function CN22LabelDoc({ order, companyName, companyAddress, customDesc, customValue, customCurrency, customHsn }: {
  order: Order; companyName?: string; companyAddress?: string;
  customDesc?: string; customValue?: number; customCurrency?: string; customHsn?: string;
}) {
  const invDate = getInvoiceDate(order);
  const dateStr = invDate.toISOString().split("T")[0]; // YYYY-MM-DD

  const recipientName    = order.fullName;
  const recipientAddr    = [order.address, order.city, order.state, order.postalCode].filter(Boolean).join(", ");
  const recipientCountry = order.country ?? "";
  const totalUsd         = customValue ?? (order.dollarAmount ?? order.amountPaid);
  const displayCurrency  = customCurrency || order.currency || "USD";
  const netWt            = order.netWeight;
  const grossWt          = order.grossWeight ?? order.netWeight;

  const hsnSet = [...new Set(order.items.map(i => i.hsn).filter(Boolean))];
  const hsnStr = customHsn?.trim() || (hsnSet.length ? hsnSet.join(", ") : "3004");

  const descRaw = order.items.map(i => i.productName).join(", ");
  const desc    = customDesc?.trim() || (descRaw.length > 55 ? "PHARMACEUTICAL PRODUCTS" : descRaw.toUpperCase());

  const senderName = companyName ?? "UNNATI PHARMAX";
  const senderAddr = companyAddress ?? "1/04 Guruvanada Appartment, Central Ave, Lakadganj, Nagpur 440008";

  const variant = getCN22Variant(recipientCountry);

  // ── Checkbox component ──
  const CB = ({ checked, label }: { checked?: boolean; label: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 6px", fontSize: "7.5pt", borderRight: "1px solid #000", borderBottom: "1px solid #000" }}>
      <span style={{ width: 11, height: 11, border: "1.5px solid #000", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "9pt", flexShrink: 0, fontWeight: 900 }}>
        {checked ? "✓" : ""}
      </span>
      {" "}{label}
    </div>
  );

  // ── Country-specific badge in right panel bottom ──
  const RightBadge = () => {
    // For prime variant, show ZIP CODE barcode area at the bottom
    if (variant === "prime") return (
      <div style={{ padding: "4px 8px" }}>
        <div style={{ border: "1px solid #000", height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "7pt", color: "#555" }}>
          Barcode for ZIP CODE
        </div>
        <div style={{ textAlign: "center", fontSize: "6.5pt", marginTop: 2, fontWeight: 700 }}>ZIP CODE</div>
      </div>
    );
    return null;
  };

  return (
    <div id="cn22-print" style={{ fontFamily: "Arial, sans-serif", fontSize: "8.5pt", color: "#000", width: "100%" }}>
      <style>{`
        #cn22-print, #cn22-print * { color: #000 !important; -webkit-text-fill-color: #000 !important; box-sizing: border-box; }
        #cn22-print { background: #fff !important; }
        #cn22-print table { border-collapse: collapse; width: 100%; }
        #cn22-print td, #cn22-print th { border: 1px solid #000 !important; }
      `}</style>

      {/* ── Outer table: left panel + right panel ── */}
      <table style={{ width: "100%", border: "2px solid #000", tableLayout: "fixed" }}>
        <tbody>
          <tr style={{ verticalAlign: "top" }}>

            {/* ═══════════════ LEFT PANEL ═══════════════ */}
            <td style={{ width: "52%", padding: 0, borderRight: "2px solid #000" }}>

              {/* Row 1: CUSTOMS DECLARATION | May be opened officially | CN 22 */}
              <table style={{ marginBottom: 0 }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid #000", borderRight: "none", width: "42%" }}>
                      <div style={{ fontWeight: 900, fontSize: "9.5pt", letterSpacing: 0.3 }}>CUSTOMS</div>
                      <div style={{ fontWeight: 900, fontSize: "9.5pt", letterSpacing: 0.3 }}>DECLARATION</div>
                    </td>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid #000", borderRight: "none", textAlign: "center", fontSize: "7pt", fontWeight: 700, width: "30%" }}>
                      May be opened<br />officially
                    </td>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid #000", borderRight: "none", textAlign: "right" }}>
                      <span style={{ fontWeight: 900, fontSize: "18pt", lineHeight: 1 }}>CN<br />22</span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Row 2: Designated operator + Barcode space */}
              <table style={{ marginBottom: 0 }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "3px 6px", borderBottom: "1px solid #000", borderRight: "1px solid #000", width: "42%", fontSize: "7.5pt" }}>
                      <div style={{ fontWeight: 600 }}>Designated operator</div>
                      <div style={{ fontWeight: 900, fontSize: "9pt" }}>India Post</div>
                    </td>
                    <td style={{ padding: "3px 6px", borderBottom: "1px solid #000", borderRight: "none", textAlign: "center", fontSize: "7pt", color: "#555" }}>
                      Space for Barcode
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Row 3: Checkboxes (2×3 grid) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #000" }}>
                <CB label="Gift" />
                <CB label="Commercial sample" />
                <CB label="Documents" />
                <CB label="Returned goods" />
                <CB label="Sale of goods" checked={true} />
                <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 6px", fontSize: "7.5pt", borderBottom: "1px solid #000" }}>
                  <span style={{ width: 11, height: 11, border: "1.5px solid #000", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} />
                  {" "}Other:
                </div>
              </div>

              {/* Row 4: Goods table */}
              <table>
                <thead>
                  <tr style={{ background: "#f0f0f0" }}>
                    <th style={{ padding: "3px 4px", fontSize: "6.5pt", fontWeight: 700, textAlign: "left", borderRight: "1px solid #000", width: "36%" }}>
                      Quantity and detailed<br />description of contents (1)
                    </th>
                    <th style={{ padding: "3px 4px", fontSize: "6.5pt", fontWeight: 700, textAlign: "center", borderRight: "1px solid #000", width: "13%" }}>
                      Net<br />weight<br />(2)
                    </th>
                    <th style={{ padding: "3px 4px", fontSize: "6.5pt", fontWeight: 700, textAlign: "center", borderRight: "1px solid #000", width: "19%" }}>
                      Value and<br />currency (3)
                    </th>
                    <th style={{ padding: "3px 4px", fontSize: "6.5pt", fontWeight: 700, textAlign: "center", borderRight: "1px solid #000", width: "17%" }}>
                      HS tariff<br />number *<br />(4)
                    </th>
                    <th style={{ padding: "3px 4px", fontSize: "6.5pt", fontWeight: 700, textAlign: "center", width: "15%" }}>
                      Country<br />of<br />origin * (5)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "5px 4px", fontSize: "8pt", fontWeight: 700, minHeight: 42, verticalAlign: "top" }}>{desc}</td>
                    <td style={{ padding: "5px 4px", textAlign: "center", fontSize: "7.5pt", fontWeight: 700 }}>
                      {netWt != null ? `${netWt.toFixed(3)} kg` : ""}
                    </td>
                    <td style={{ padding: "5px 4px", textAlign: "center", fontSize: "8pt", fontWeight: 700 }}>
                      {typeof totalUsd === "number" ? totalUsd.toFixed(2) : totalUsd} {displayCurrency}
                    </td>
                    <td style={{ padding: "5px 4px", textAlign: "center", fontSize: "7.5pt" }}>{hsnStr}</td>
                    <td style={{ padding: "5px 4px", textAlign: "center", fontSize: "8pt", fontWeight: 700 }}>India</td>
                  </tr>
                  {/* Filler row for space */}
                  <tr>
                    <td colSpan={5} style={{ height: 18 }}>&nbsp;</td>
                  </tr>
                </tbody>
              </table>

              {/* Row 5: Totals */}
              <table>
                <tbody>
                  <tr>
                    <td style={{ padding: "3px 6px", fontSize: "7.5pt", borderRight: "1px solid #000", width: "50%" }}>
                      <span style={{ fontWeight: 700 }}>Total weight <em>(in kg)</em>:</span>
                      &nbsp;{grossWt != null ? grossWt.toFixed(3) : ""}
                      &nbsp;&nbsp;<span style={{ fontWeight: 700 }}>(6)</span>
                    </td>
                    <td style={{ padding: "3px 6px", fontSize: "7.5pt" }}>
                      <span style={{ fontWeight: 700 }}>Total value:</span>
                      &nbsp;{typeof totalUsd === "number" ? totalUsd.toFixed(2) : totalUsd} {displayCurrency}
                      &nbsp;&nbsp;<span style={{ fontWeight: 700 }}>(7)</span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Row 6: Declaration */}
              <div style={{ padding: "4px 6px", fontSize: "6pt", lineHeight: 1.45, borderTop: "1px solid #000" }}>
                <strong>I, the undersigned, whose name and address are given on the item,
                certify that the particulars given in this declaration are correct and that
                this item does not</strong> contain and dangerous article or articles prohibited by
                legislation or by postal or customs regulations <strong>(8)</strong>
              </div>

              {/* Row 7: Signature */}
              <table>
                <tbody>
                  <tr>
                    <td style={{ padding: "3px 6px", fontSize: "7pt", borderRight: "1px solid #000", width: "50%" }}>
                      Date and sender&apos;s signature<br />
                      <span style={{ fontWeight: 700 }}>{dateStr}</span>
                    </td>
                    <td style={{ padding: "3px 6px", fontSize: "7pt" }}>
                      Signature
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>

            {/* ═══════════════ RIGHT PANEL ═══════════════ */}
            <td style={{ width: "48%", padding: 0, verticalAlign: "top" }}>

              {/* Top: Country logo | Barcode space | India Post logo */}
              <table style={{ borderBottom: "1px solid #000" }}>
                <tbody>
                  <tr>
                    {/* Cell 1: country-specific logo (or plain barcode space for standard/DNKN) */}
                    <td style={{ padding: "4px 6px", textAlign: "center", borderRight: "1px solid #000", width: "40%", verticalAlign: "middle" }}>
                      {variant === "track" && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src="/china etc.png" alt="globe" style={{ maxHeight: 44, maxWidth: "100%", objectFit: "contain", display: "block", margin: "0 auto" }} />
                      )}
                      {variant === "prime" && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src="/us-canada.png" alt="prime" style={{ maxHeight: 44, maxWidth: "100%", objectFit: "contain", display: "block", margin: "0 auto" }} />
                      )}
                      {variant === "epacket" && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src="/combodia-japan.png" alt="epacket" style={{ maxHeight: 44, maxWidth: "100%", objectFit: "contain", display: "block", margin: "0 auto" }} />
                      )}
                      {variant === "standard" && (
                        <span style={{ fontSize: "7pt", color: "#555" }}>Space for Barcode</span>
                      )}
                    </td>
                    {/* Cell 2: main barcode space */}
                    <td style={{ padding: "4px 6px", fontSize: "7pt", textAlign: "center", color: "#555", width: "35%" }}>
                      Space for Barcode
                    </td>
                    {/* Cell 3: India Post logo + DNKN for standard */}
                    <td style={{ padding: "3px 4px", textAlign: "center", borderLeft: "1px solid #000", width: "25%", verticalAlign: "middle" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/indian post logo.png" alt="India Post" style={{ maxHeight: 44, maxWidth: "100%", objectFit: "contain", display: "block", margin: "0 auto" }} />
                      {variant === "standard" && (
                        <div style={{ fontSize: "6pt", fontWeight: 700, marginTop: 2 }}>DNKN(9)</div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* FROM section */}
              <table style={{ borderBottom: "1px solid #000" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "3px 5px", width: "18%", borderRight: "1px solid #000", textAlign: "center" }}>
                      <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontWeight: 900, fontSize: "8pt", letterSpacing: 1 }}>FROM (10)</div>
                    </td>
                    <td style={{ padding: "5px 6px", fontSize: "7.5pt", lineHeight: 1.6 }}>
                      <div style={{ fontWeight: 800 }}>{senderName}</div>
                      <div>{senderAddr}</div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* TO section — tall to match original label design */}
              <table style={{ borderBottom: "1px solid #000" }}>
                <tbody>
                  <tr style={{ height: 90 }}>
                    <td style={{ padding: "3px 5px", width: "18%", borderRight: "1px solid #000", textAlign: "center", verticalAlign: "middle" }}>
                      <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontWeight: 900, fontSize: "8pt", letterSpacing: 1 }}>TO (11)</div>
                    </td>
                    <td style={{ padding: "5px 6px", fontSize: "8pt", lineHeight: 1.7, verticalAlign: "top" }}>
                      <div style={{ fontWeight: 800, fontSize: "9pt" }}>{recipientName}</div>
                      <div>{recipientAddr}</div>
                      <div style={{ fontWeight: 800, marginTop: 3 }}>{recipientCountry}</div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Bottom: ZIP CODE barcode (prime) + QR / Track & Trace */}
              <table>
                <tbody>
                  <tr>
                    <td style={{ padding: "4px 8px", verticalAlign: "middle" }}>
                      <RightBadge />
                    </td>
                    <td style={{ padding: "4px 6px", textAlign: "center", verticalAlign: "bottom", width: "40%" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/tracking qr.png" alt="QR" style={{ width: 52, height: 52, objectFit: "contain", display: "block", margin: "0 auto" }} />
                      <div style={{ fontSize: "6.5pt", fontWeight: 700, marginTop: 3, letterSpacing: 0.5 }}>Track &amp; Trace</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── DOC 3: Form-II (template) ────────────────────────────────────────────────
function Form2Doc({ order }: { order: Order }) {
  const invDate  = getInvoiceDate(order);
  const dateStr  = invDate.toLocaleDateString("en-GB").replaceAll("/", ".");
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
  const hsn      = order.items[0]?.hsn ?? "3004";
  const fob      = order.dollarAmount ?? 0;
  const exRate   = order.exchangeRate ?? 84;
  const amtInr   = Math.round(fob * exRate * 100) / 100;
  const mode     = (order.shipmentMode ?? "EMS").toUpperCase();
  const mQty     = (m: string) => m === mode ? totalQty : 0;

  const cityLine = [order.city, order.state].filter(Boolean).join(", ");
  const buyerAddr = [order.fullName, order.address, cityLine + " " + order.postalCode, order.country].filter(Boolean).join("\n");

  const b = "1px solid #000";
  const td:  React.CSSProperties = { border: b, padding: "2px 3px", verticalAlign: "middle", fontSize: "7px", color: "#000", background: "#fff" };
  const th:  React.CSSProperties = { ...td, fontWeight: "bold", textAlign: "center", fontSize: "6.5px" };
  const yw:  React.CSSProperties = { ...td };
  const ctr: React.CSSProperties = { textAlign: "center" as const };
  const tbl: React.CSSProperties = { width: "100%", borderCollapse: "collapse" as const };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: "7px", color: "#000", background: "#fff" }}>

      {/* ══ TITLE ══ */}
      <table style={tbl}><tbody>
        <tr>
          <td style={{ ...yw, textAlign: "center", fontSize: "10px", padding: "5px 4px", lineHeight: 1.5 }}>
            <strong>FORM-II</strong>&nbsp;&nbsp;
            <span style={{ fontWeight: 400, fontSize: "8px" }}>(see regulation 4)</span><br/>
            <strong style={{ fontSize: "9px" }}>Postal Bill of Export – II (To be submitted in duplicate)</strong>
          </td>
        </tr>
      </tbody></table>

      {/* ══ EXPORTER INFO ══ */}
      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "9%" }}/><col style={{ width: "6%" }}/><col style={{ width: "9%" }}/>
          <col style={{ width: "18%" }}/><col style={{ width: "8%" }}/><col style={{ width: "4%" }}/>
          <col style={{ width: "12%" }}/><col style={{ width: "11%" }}/><col style={{ width: "11%" }}/><col style={{ width: "12%" }}/>
        </colgroup>
        <thead>
          <tr>
            <th style={th}>Bill of Export<br/>No. and date.</th>
            <th style={th}>Foreign Post<br/>office code</th>
            <th style={th}>Name of Exporter</th>
            <th style={th}>Address of Exporter</th>
            <th style={th}>IEC</th>
            <th style={th}>State<br/>code</th>
            <th style={th}>GSTIN or as<br/>applicable</th>
            <th style={th}>AD code<br/>(if applicable)</th>
            <th style={th}>Details of Customs Broker<br/>License No.</th>
            <th style={th}>Name and address</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...td, ...ctr }}>{order.invoiceNo ?? ""}<br/>{dateStr}</td>
            <td style={{ ...td, ...ctr }}>INBOM5</td>
            <td style={{ ...td, fontWeight: "bold" }}>UNNATI PHARMAX</td>
            <td style={td}>SHOP NO 181 GURUKRUPA APARTMENT, CENTRAL AVE, LAKADGANJ NAGPUR MAHARSHTRA 440008</td>
            <td style={{ ...td, ...ctr }}>FNXPP3883B</td>
            <td style={{ ...td, ...ctr }}>27</td>
            <td style={td}>27FNXPP3883B1ZA</td>
            <td style={td}>0180387-6400009</td>
            <td style={{ ...td, ...ctr }}>11/2440</td>
            <td style={td}>CROSSWATER LOGISTICS</td>
          </tr>
        </tbody>
      </table>

      {/* ══ DECLARATIONS ══ */}
      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "4%" }}/><col style={{ width: "87%" }}/><col style={{ width: "9%" }}/>
        </colgroup>
        <tbody>
          <tr>
            <td style={{ ...td, ...ctr, fontWeight: "bold" }} colSpan={2}>Declaration</td>
            <td style={{ ...td, ...ctr, fontWeight: "bold" }}>Yes/No as applicable</td>
          </tr>
          <tr>
            <td style={{ ...td, ...ctr }}>1</td>
            <td style={td}>We declare that we intend to claim rewards under Merchandise Exports from India Scheme (MEIS)(for export through Chennai / Mumbai / Delhi FPO only).</td>
            <td style={{ ...td, ...ctr, fontWeight: "bold" }}>NO</td>
          </tr>
          <tr>
            <td style={{ ...td, ...ctr }}>2</td>
            <td style={td}>We declare that we intend to zero rate our exports under Section 16 of IGST Act.</td>
            <td style={{ ...td, ...ctr, fontWeight: "bold" }}>YES</td>
          </tr>
          <tr>
            <td style={{ ...td, ...ctr }}>3</td>
            <td style={td}>We declare that the goods are exempted under CGST/SGST/UTGST/IGST Acts.</td>
            <td style={{ ...td, ...ctr, fontWeight: "bold" }}>NO</td>
          </tr>
          <tr>
            <td colSpan={3} style={td}>
              We hereby declare that the contents of this postal bill of export are true and correct in every respect.
            </td>
          </tr>
        </tbody>
      </table>

      {/* ══ SIGNATURE ══ */}
      <table style={tbl}>
        <tbody>
          <tr>
            <td style={{ ...td, width: "38%", height: 34, verticalAlign: "bottom" }}>
              (Signature of the Exporter/ Authorised agent)<br/>
              <strong>For UNNATI PHARMAX</strong>
            </td>
            <td style={{ ...td, verticalAlign: "top" }}>Examination order and report</td>
            <td style={{ ...td, textAlign: "right", verticalAlign: "bottom", width: "38%" }}>
              Let Export Order: Signature of officer of Customs along with stamp and date.
            </td>
          </tr>
        </tbody>
      </table>

      {/* ══ DETAILS OF PARCEL ══
          Cols: Consignee | Buyer | Country | Desc | CTH | Unit | No | InvNo | Date | Gross | Net | EMS | RMS | CM | ITPS | FOB | Curr | ExRate | AmtINR
      */}
      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "10%" }}/> {/* Consignee */}
          <col style={{ width: "12%" }}/> {/* Buyer */}
          <col style={{ width: "6%" }}/>  {/* Country */}
          <col style={{ width: "8%" }}/>  {/* Description */}
          <col style={{ width: "4%" }}/>  {/* CTH */}
          <col style={{ width: "5%" }}/>  {/* Unit */}
          <col style={{ width: "3%" }}/>  {/* No */}
          <col style={{ width: "7%" }}/>  {/* Invoice no */}
          <col style={{ width: "5%" }}/>  {/* Date */}
          <col style={{ width: "5%" }}/>  {/* Gross */}
          <col style={{ width: "4%" }}/>  {/* Net */}
          <col style={{ width: "3%" }}/>  {/* EMS */}
          <col style={{ width: "3%" }}/>  {/* RMS */}
          <col style={{ width: "3%" }}/>  {/* CM */}
          <col style={{ width: "3%" }}/>  {/* ITPS */}
          <col style={{ width: "4%" }}/>  {/* FOB */}
          <col style={{ width: "4%" }}/>  {/* Currency */}
          <col style={{ width: "5%" }}/>  {/* ExRate */}
          <col style={{ width: "6%" }}/>  {/* AmtINR */}
        </colgroup>
        <thead>
          {/* Group header row */}
          <tr>
            <th style={th}>Consignee details</th>
            <th style={th}>Buyer details</th>
            <th style={th} colSpan={3}></th>
            <th style={{ ...th, ...ctr }} colSpan={2}>Details of Parcel</th>
            <th style={th} colSpan={3}>Details of Parcel</th>
            <th style={th} colSpan={2}>Weight</th>
            <th style={th} colSpan={4}>Postal tracking number</th>
            <th style={th} colSpan={4}>Assessable value under section 14 of the Customs Act</th>
          </tr>
          {/* Column header row */}
          <tr>
            <th style={th}>Name and Address</th>
            <th style={th}>Name and Address</th>
            <th style={th}>Country of destination</th>
            <th style={th}>Description</th>
            <th style={th}>CTH</th>
            <th style={th}>Unit<br/><span style={{ fontWeight: 400, fontSize: "6px" }}>(pieces, liters, kgs., meters)</span></th>
            <th style={th}>No</th>
            <th style={th}>Invoice no.</th>
            <th style={th}>Date</th>
            <th style={th}>Gross</th>
            <th style={th}>net</th>
            <th style={th}>EMS</th>
            <th style={th}>RMS</th>
            <th style={th}>CM</th>
            <th style={th}>ITPS</th>
            <th style={th}>FOB</th>
            <th style={th}>Currency</th>
            <th style={th}>Exchange rate</th>
            <th style={th}>Amount in INR</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...td, verticalAlign: "top" }}>
              AS PER PACKING LIST<br/>
              <span style={{ fontSize: "6px" }}>AS PER PACKING LIST / As per Annexure</span>
            </td>
            <td style={{ ...td, verticalAlign: "top", whiteSpace: "pre-line" }}>{buyerAddr}</td>
            <td style={{ ...td, ...ctr }}>AS PER ANNEXURE ATTACHED</td>
            <td style={{ ...td, fontWeight: "bold" }}>PHARMACEUTICAL PRODUCT</td>
            <td style={{ ...td, ...ctr }}>{hsn}</td>
            <td style={{ ...td, ...ctr }}>pieces</td>
            <td style={{ ...td, ...ctr, fontWeight: "bold" }}>{totalQty}</td>
            <td style={{ ...td, ...ctr }}>{order.invoiceNo ?? "—"}</td>
            <td style={{ ...td, ...ctr }}>{dateStr}</td>
            <td style={{ ...td, fontSize: "6px" }}>AS PER ANNEXURE ATTACHED</td>
            <td style={{ ...td, fontSize: "6px" }}>AS PER ANNEXURE ATTACHED</td>
            <td style={{ ...td, ...ctr }}>{mQty("EMS")}</td>
            <td style={{ ...td, ...ctr }}>{mQty("RMS")}</td>
            <td style={{ ...td, ...ctr }}>{mQty("CM")}</td>
            <td style={{ ...td, ...ctr }}>{mQty("ITPS")}</td>
            <td style={{ ...td, ...ctr, fontWeight: "bold" }}>{fob.toFixed(2)}</td>
            <td style={{ ...td, ...ctr }}>{order.currency}</td>
            <td style={{ ...td, ...ctr }}>{exRate.toFixed(2)}</td>
            <td style={{ ...td, ...ctr, fontWeight: "bold" }}>{amtInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      {/* ══ TAX INVOICE DETAILS ══ */}
      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "5%" }}/>  {/* HSN */}
          <col style={{ width: "9%" }}/>  {/* Inv no+date */}
          <col style={{ width: "5%" }}/>  {/* Sl No */}
          <col style={{ width: "6%" }}/>  {/* value */}
          <col style={{ width: "4%" }}/>  {/* exp duty rate */}
          <col style={{ width: "4%" }}/>  {/* exp duty amt */}
          <col style={{ width: "4%" }}/>  {/* cess rate */}
          <col style={{ width: "4%" }}/>  {/* cess amt */}
          <col style={{ width: "4%" }}/>  {/* IGST rate */}
          <col style={{ width: "4%" }}/>  {/* IGST amt */}
          <col style={{ width: "5%" }}/>  {/* comp cess rate */}
          <col style={{ width: "5%" }}/>  {/* comp cess amt */}
          <col style={{ width: "4%" }}/>  {/* GST rate */}
          <col style={{ width: "4%" }}/>  {/* GST amt */}
          <col style={{ width: "13%" }}/> {/* LUT/ARN */}
          <col style={{ width: "5%" }}/>  {/* duty */}
          <col style={{ width: "5%" }}/>  {/* cess */}
          <col style={{ width: "5%" }}/>  {/* total */}
        </colgroup>
        <thead>
          <tr>
            <th style={th} colSpan={18}>Details of Tax invoice or commercial invoice (whichever applicable)</th>
          </tr>
          <tr>
            <th style={th} rowSpan={2}>H.S.N<br/>code</th>
            <th style={th} colSpan={3}>Invoice details</th>
            <th style={th} colSpan={6}>Customs duties</th>
            <th style={th} colSpan={2}>Compensation cess<br/>(if applicable)</th>
            <th style={th} colSpan={4}>GST details</th>
            <th style={th} rowSpan={2}>total</th>
          </tr>
          <tr>
            <th style={th} colSpan={2}>invoice no. and date</th>
            <th style={th}>Sl. No. of<br/>item in<br/>invoice</th>
            <th style={{ ...th, fontSize: "6px" }}>value</th>
            <th style={th} colSpan={2}>Export duty<br/>rate &nbsp;|&nbsp; amount</th>
            <th style={th} colSpan={2}>Cess<br/>rate &nbsp;|&nbsp; amount</th>
            <th style={th} colSpan={2}>IGST (if applicable)<br/>rate &nbsp;|&nbsp; amount</th>
            <th style={th}>rate</th>
            <th style={th}>amount</th>
            <th style={th}>rate</th>
            <th style={th}>amount</th>
            <th style={{ ...th, fontSize: "6px" }}>LUT/ bond details (if applicable) ARN NO.</th>
            <th style={th}>duty</th>
            <th style={th}>cess</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...td, ...ctr }}>{hsn}</td>
            <td style={{ ...td, ...ctr }} colSpan={2}>{order.invoiceNo ?? "—"}<br/>{dateStr}</td>
            <td style={{ ...td, ...ctr }}>{totalQty}</td>
            <td style={{ ...td, ...ctr }}>{fob.toFixed(2)}</td>
            <td style={{ ...td, ...ctr }}>0</td>
            <td style={{ ...td, ...ctr }}>0</td>
            <td style={{ ...td, ...ctr }}>0</td>
            <td style={{ ...td, ...ctr }}>0</td>
            <td style={{ ...td, ...ctr }}>0</td>
            <td style={{ ...td, ...ctr }}>0</td>
            <td style={{ ...td, ...ctr }}>0</td>
            <td style={{ ...td, ...ctr }}>0</td>
            <td style={{ ...td, ...ctr }}>0</td>
            <td style={{ ...td, ...ctr }}>0</td>
            <td style={{ ...td, ...ctr, fontSize: "6px" }}>{order.licenseNo ?? "AD270326012421K"}</td>
            <td style={{ ...td, ...ctr }}>0</td>
            <td style={{ ...td, ...ctr }}>0</td>
            <td style={{ ...td, ...ctr }}>0</td>
          </tr>
        </tbody>
      </table>

    </div>
  );
}

// ── DOC 4: EDF ────────────────────────────────────────────────────────────────
function EdfDoc({ order }: { order: Order }) {
  const invDate  = getInvoiceDate(order);
  const dateDot  = invDate.toLocaleDateString("en-GB").replaceAll("/", ".");  // DD.MM.YYYY
  const dateFull = invDate.toLocaleDateString("en-GB");                        // DD/MM/YYYY
  const dateLong = invDate.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const cnfFc      = order.dollarAmount ?? 0;
  const freightFc  = order.shippingPrice;
  const fobFc      = Math.max(0, cnfFc - freightFc);
  const exRate     = order.exchangeRate ?? 84;
  const fobInr     = Math.round(fobFc * exRate * 100) / 100;
  const freightInr = Math.round(freightFc * exRate * 100) / 100;
  const netReal    = Math.round(cnfFc * exRate * 100) / 100;

  function numWords(n: number): string {
    const ones = ["","ONE","TWO","THREE","FOUR","FIVE","SIX","SEVEN","EIGHT","NINE","TEN","ELEVEN","TWELVE","THIRTEEN","FOURTEEN","FIFTEEN","SIXTEEN","SEVENTEEN","EIGHTEEN","NINETEEN"];
    const tens = ["","","TWENTY","THIRTY","FORTY","FIFTY","SIXTY","SEVENTY","EIGHTY","NINETY"];
    if (n === 0) return "";
    if (n < 20)  return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " "+ones[n%10] : "");
    if (n < 1000) return ones[Math.floor(n/100)]+" HUNDRED"+(n%100?" "+numWords(n%100):"");
    if (n < 100000) return numWords(Math.floor(n/1000))+" THOUSAND"+(n%1000?" "+numWords(n%1000):"");
    if (n < 10000000) return numWords(Math.floor(n/100000))+" LAKH"+(n%100000?" "+numWords(n%100000):"");
    return numWords(Math.floor(n/10000000))+" CRORE"+(n%10000000?" "+numWords(n%10000000):"");
  }
  const fobInt   = Math.floor(fobInr);
  const fobPaise = Math.round((fobInr - fobInt) * 100);
  const fobWords = (numWords(fobInt) || "ZERO") + " RUPEES" + (fobPaise ? " AND "+numWords(fobPaise)+" PAISE" : "") + " ONLY";

  const b   = "1px solid #000";
  const td:  React.CSSProperties = { border: b, padding: "1px 3px", verticalAlign: "top", fontSize: "7px", color: "#000", background: "#fff" };
  const th:  React.CSSProperties = { ...td, fontWeight: "bold", textAlign: "center", fontSize: "6.5px" };
  const tbl: React.CSSProperties = { width: "100%", borderCollapse: "collapse" as const };
  const hl:  React.CSSProperties = { ...td, fontWeight: "bold", textAlign: "center", fontSize: "9px" };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: "7px", color: "#000", background: "#fff", display: "flex", gap: 0, alignItems: "stretch" }}>

      {/* ═══ LEFT COLUMN: Sections 1 & 2 ═══ */}
      <div style={{ flex: "0 0 55%", borderRight: "2px solid #000", paddingRight: 3 }}>

        {/* Title */}
        <table style={tbl}><tbody><tr>
          <td style={{ ...td, textAlign: "center", fontWeight: "bold", fontSize: "9px", padding: "3px" }}>EXPORT DECLARATION FORM</td>
          <td style={{ ...td, textAlign: "right", fontWeight: "bold", fontSize: "7px" }}>Annex I</td>
        </tr></tbody></table>

        {/* Section 1 header */}
        <table style={tbl}><tbody>
          <tr><td style={{ ...td, fontWeight: "bold" }}>1.&nbsp;&nbsp;General Information:</td></tr>
          <tr>
            <td style={td}>Customs Security No.: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              Form No: <strong style={{ fontSize: "8px" }}>{order.invoiceNo ?? ""}</strong>
            </td>
          </tr>
          <tr>
            <td style={td}>Nature of Cargo: &nbsp;&nbsp; [ ] Government &nbsp; [&#10003;] Non-Government &nbsp;&nbsp;&nbsp; Shipping Bill No. &amp; Date:</td>
          </tr>
          <tr>
            <td style={td}>[ ] Sea &nbsp;[&#10003;] Post/Couriers &nbsp;[ ] others &nbsp;&nbsp;&nbsp;&nbsp; By POST &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; RBI approval no. &amp; date, if any:</td>
          </tr>
          <tr>
            <td style={td}>Category of Exporter: [ ] Custom (DTA units) [ ] SEZ [ ] Status holder exporters [ ] 100% EOU [ ] Warehouse export [ ] others (Specify).......</td>
          </tr>
          <tr>
            <td style={td}>IE Code: <strong>FNXPP3883B</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; AD code: <strong>0180387-6400009</strong></td>
          </tr>
        </tbody></table>

        {/* Exporter + AD bank side by side */}
        <table style={{ ...tbl, tableLayout: "fixed" }}><colgroup><col style={{ width: "50%" }}/><col style={{ width: "50%" }}/></colgroup>
          <tbody>
            <tr>
              <td style={{ ...td, fontWeight: "bold" }}>Exporters Name &amp; Address:</td>
              <td style={{ ...td, fontWeight: "bold" }}>AD Name &amp; Address:</td>
            </tr>
            <tr>
              <td style={{ ...td, fontWeight: "bold" }}>UNNATI PHARMAX</td>
              <td style={{ ...td, fontWeight: "bold" }}>KOTAK MAHINDRA BANK</td>
            </tr>
            <tr>
              <td style={td}>SHOP NO 181 GURUKRUPA APARTMENT</td>
              <td style={td}>274 - SHENDRE COMPLEX</td>
            </tr>
            <tr>
              <td style={td}>CENTRAL AVE</td>
              <td style={td}>CHAPRU NAGAR SQUARE, CA ROAD</td>
            </tr>
            <tr>
              <td style={td}>LAKADGANJ NAGPUR</td>
              <td style={td}>VardhmanNagar, Nagpur-440008</td>
            </tr>
            <tr>
              <td style={td}></td>
              <td style={td}>Maharashtra</td>
            </tr>
          </tbody>
        </table>

        {/* Consignee + Mode of Realisation side by side */}
        <table style={{ ...tbl, tableLayout: "fixed" }}><colgroup><col style={{ width: "50%" }}/><col style={{ width: "50%" }}/></colgroup>
          <tbody>
            <tr>
              <td style={{ ...td, fontWeight: "bold" }}>Consignee&apos;s Name &amp; Address:</td>
              <td style={td}>Mode of Realisation : [ ] L/C [ ] BG [ ] Others<br/>
                (advance payment, etc. including transfer/remittance to<br/>
                I/We @ am/are not in the Caution List of the Reserve Bank of India.
              </td>
            </tr>
            <tr>
              <td style={{ ...td, fontWeight: "bold" }}>AS PER PACKING LIST</td>
              <td style={td}>bank account maintained overseas )</td>
            </tr>
            <tr>
              <td style={td}></td>
              <td style={td}>Port of Loading / Source Port in case of SEZ :</td>
            </tr>
            <tr>
              <td style={td}></td>
              <td style={{ ...td, fontWeight: "bold" }}>MUMBAI</td>
            </tr>
            <tr>
              <td style={td}>AS PER PACKING LIST / As per Annexure</td>
              <td style={td}>Date: <strong>{dateDot}</strong></td>
            </tr>
            <tr>
              <td style={td}></td>
              <td style={{ ...td, textAlign: "right", fontWeight: "bold" }}>Autorised Signatory</td>
            </tr>
          </tbody>
        </table>

        {/* Country of Destination + Port of Discharge */}
        <table style={{ ...tbl, tableLayout: "fixed" }}><colgroup><col style={{ width: "35%" }}/><col style={{ width: "35%" }}/><col style={{ width: "30%" }}/></colgroup>
          <tbody>
            <tr>
              <td style={{ ...td, fontWeight: "bold" }}>Name of the Indian bank and AD code, in case of LC/BG</td>
              <td style={{ ...td, fontWeight: "bold" }}>Country of Destination:</td>
              <td style={{ ...td, fontWeight: "bold" }}>Port of Discharge:</td>
            </tr>
            <tr>
              <td style={td}></td>
              <td style={td}>AS PER PACKING LIST / As per Annexure</td>
              <td style={td}>AS PER PACKING LIST / As per Annexure</td>
            </tr>
          </tbody>
        </table>

        {/* ACU + Let Export */}
        <table style={{ ...tbl, tableLayout: "fixed" }}><colgroup><col style={{ width: "50%" }}/><col style={{ width: "50%" }}/></colgroup>
          <tbody>
            <tr>
              <td style={td}>Whether payment to be<br/>Received through ACU?<br/>[ ] Yes [ ] No</td>
              <td style={td}>Let Export order (LEO) Date:</td>
            </tr>
          </tbody>
        </table>

        {/* General Commodity + State of Origin */}
        <table style={{ ...tbl, tableLayout: "fixed" }}><colgroup><col style={{ width: "50%" }}/><col style={{ width: "50%" }}/></colgroup>
          <tbody>
            <tr>
              <td style={{ ...td, fontWeight: "bold" }}>General Commodity Description:</td>
              <td style={{ ...td, fontWeight: "bold" }}>State of Origin of Goods:</td>
            </tr>
            <tr>
              <td style={td}>Pharmaceutical products</td>
              <td style={td}>INDIA</td>
            </tr>
          </tbody>
        </table>

        {/* FOB in words + Assessable value */}
        <table style={{ ...tbl, tableLayout: "fixed" }}><colgroup><col style={{ width: "55%" }}/><col style={{ width: "45%" }}/></colgroup>
          <tbody>
            <tr>
              <td style={{ ...td, fontWeight: "bold" }}>Total FOB value in words (INR):</td>
              <td style={{ ...td, fontWeight: "bold" }}>Custom Assessable value (INR)*:</td>
            </tr>
            <tr>
              <td style={{ ...td, fontStyle: "italic", fontWeight: "bold" }}>{fobWords}</td>
              <td style={hl}>Rs &nbsp;{fobInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })} /-</td>
            </tr>
          </tbody>
        </table>

        {/* Section 2 */}
        <table style={tbl}><tbody>
          <tr><td style={{ ...td, fontWeight: "bold" }}>2. Invoice –Wise details of Export Value</td></tr>
          <tr><td style={{ ...td, fontSize: "6px" }}>( If more than one invoice for a particular shipping bill , the block 2 will repeat as many times of invoices)</td></tr>
        </tbody></table>

        {/* Invoice meta */}
        <table style={{ ...tbl, tableLayout: "fixed" }}><colgroup><col style={{ width: "25%" }}/><col style={{ width: "20%" }}/><col style={{ width: "55%" }}/></colgroup>
          <tbody>
            <tr>
              <td style={td}>Invoice No</td>
              <td style={td}>Invoice Currency:</td>
              <td style={td}>Nature of Contract:</td>
            </tr>
            <tr>
              <td style={hl}>{order.invoiceNo ?? "—"}</td>
              <td style={{ ...td, fontWeight: "bold" }}>{order.currency}</td>
              <td style={td}>[ ] FOB &nbsp;[ ] CIF &nbsp;[&#10003;] C&amp;F &nbsp;[ ] CI &nbsp;[ ] Others</td>
            </tr>
            <tr>
              <td style={td}>Invoice date.</td>
              <td style={td}>Invoice Amount:</td>
              <td style={td}></td>
            </tr>
            <tr>
              <td style={hl}>{dateDot}</td>
              <td style={hl}>{cnfFc.toFixed(2)}</td>
              <td style={td}></td>
            </tr>
          </tbody>
        </table>

        {/* Particulars table */}
        <table style={tbl}>
          <thead>
            <tr>
              {["Particulars","Currency","Amount in FC","Exchange Rate","Amount (INR)"].map(h => (
                <th key={h} style={{ ...th, textAlign: "center" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: "FOB Value",       cur: order.currency, fc: fobFc,     exr: exRate, inr: fobInr     },
              { label: "Freight",         cur: order.currency, fc: freightFc, exr: exRate, inr: freightInr },
              { label: "Insurance",       cur: null, fc: null, exr: null, inr: null },
              { label: "Commission",      cur: null, fc: null, exr: null, inr: null },
              { label: "Discount",        cur: null, fc: null, exr: null, inr: null },
              { label: "Other Deduction", cur: null, fc: null, exr: null, inr: null },
              { label: "Packing Charges", cur: null, fc: null, exr: null, inr: null },
            ].map((row, i) => (
              <tr key={i}>
                <td style={td}>{row.label}</td>
                <td style={{ ...td, textAlign: "center" }}>{row.cur ?? ""}</td>
                <td style={{ ...td, textAlign: "right" }}>{row.fc != null ? row.fc.toFixed(2) : ""}</td>
                <td style={{ ...td, textAlign: "right" }}>{row.exr != null ? row.exr.toFixed(2) : ""}</td>
                <td style={{ ...td, textAlign: "right" }}>{row.inr != null ? row.inr.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : ""}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} style={{ ...td, textAlign: "center", fontWeight: "bold" }}>Net Realisable value</td>
              <td style={{ ...td, textAlign: "right", fontWeight: "bold" }}>{netReal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>
      </div>{/* end LEFT */}

      {/* ═══ RIGHT COLUMN: Sections 3, 4, 5 ═══ */}
      <div style={{ flex: "0 0 45%", paddingLeft: 3 }}>

        {/* Cont. title */}
        <table style={tbl}><tbody><tr>
          <td style={{ ...td, textAlign: "center", fontWeight: "bold", fontSize: "9px", padding: "3px" }}>EXPORT DECLARATION FORM - Cont.</td>
        </tr></tbody></table>

        {/* Section 3 */}
        <table style={tbl}><tbody>
          <tr><td style={{ ...td, fontWeight: "bold" }}>3.&nbsp;&nbsp;Applicable for Export under FPO/Couriers</td></tr>
        </tbody></table>
        <table style={{ ...tbl, tableLayout: "fixed" }}><colgroup><col style={{ width: "60%" }}/><col style={{ width: "40%" }}/></colgroup>
          <tbody>
            <tr>
              <td style={td}>Name of the post Office:<br/><br/><strong>INBOM5</strong><br/><strong>FBO, MUMBAI</strong></td>
              <td style={td}>Form No: <strong>{order.invoiceNo ?? ""}</strong></td>
            </tr>
            <tr>
              <td style={{ ...td, height: 32 }}>Number &amp; date of Parcel receipts :</td>
              <td style={{ ...td, textAlign: "right" }}>Stamp &amp; Signature of Authorised Dealer</td>
            </tr>
          </tbody>
        </table>

        {/* Section 4 */}
        <table style={tbl}><tbody>
          <tr><td style={{ ...td, fontWeight: "bold" }}>4.&nbsp;&nbsp;Declaration by the Exporters (All types of exports)</td></tr>
          <tr>
            <td style={{ ...td, lineHeight: 1.5, fontSize: "6.5px" }}>
              I /We hereby declare that I/we @am/are the seller/consignor of the goods in respect of which this declaration is made and
              that the particulars given above are true and that the value to be received from the buyer represents the export value
              contracted and declared above. I/We undertake that I/we will deliver to the authorised dealer bank named above the foreign
              exchange representing the full value of the goods exported as above on or before........................ (i.e. within the period of
              realisation stipulated by RBI from time to time ) in the manner specified in the Regulations made under the Foreign Exchange
              Management Act, 1999.
            </td>
          </tr>
          <tr>
            <td style={{ ...td, fontSize: "6.5px" }}>
              I/We &nbsp;&nbsp;&nbsp; @ &nbsp;am/are not in the Caution List of the Reserve Bank of India.
            </td>
          </tr>
          <tr>
            <td style={{ ...td, height: 28, verticalAlign: "bottom" }}>
              Date: <strong>{dateDot}</strong>
            </td>
          </tr>
          <tr>
            <td style={{ ...td, textAlign: "right", fontWeight: "bold", paddingBottom: 4 }}>Autorised Signatory</td>
          </tr>
        </tbody></table>

        {/* Section 5 */}
        <table style={tbl}><tbody>
          <tr><td style={{ ...td, fontWeight: "bold" }}>5.&nbsp;&nbsp;Space for use of the competent authority (i.e. Custom/SEZ) on behalf of Ministry concerned:</td></tr>
          <tr>
            <td style={{ ...td, fontSize: "6.5px", lineHeight: 1.5 }}>
              Certified, on the basis of above declaration by the Custom/SEZ unit, that the Goods described above and the export value declared by the exporter in this form
              is as per the corresponding invoice/gist of invoices submitted and declared by the Unit.
            </td>
          </tr>
          <tr>
            <td style={{ ...td, height: 28, verticalAlign: "bottom" }}>Date:</td>
          </tr>
          <tr>
            <td style={{ ...td, textAlign: "right", fontSize: "6.5px" }}>(Signature of Designated/Authorised officials of Custom /SEZ)</td>
          </tr>
        </tbody></table>

      </div>{/* end RIGHT */}

    </div>
  );

}

// ── Multi-order: Export Invoice (USD) ────────────────────────────────────────
function MultiExportInvoiceDoc({ orders }: { orders: Order[] }) {
  const first     = orders[0];
  const exchRate  = first.exchangeRate || 84;
  const invDate   = getInvoiceDate(first);
  const dateStr   = invDate.toLocaleDateString("en-GB").replaceAll("/", ".");

  // Combined totals
  const expCnfUsd  = orders.reduce((s, o) => s + (o.dollarAmount ?? 0), 0);
  const expShipUsd = orders.reduce((s, o) => s + o.shippingPrice, 0);
  const expFobUsd  = Math.max(0, expCnfUsd - expShipUsd);
  const expFobInr  = Math.round(expFobUsd * exchRate * 100) / 100;
  const expCnfInr  = Math.round(expCnfUsd * exchRate * 100) / 100;

  // Flat list of all items across all orders with USD pricing
  const allItems = orders.flatMap(o => {
    const totalItemInr = o.items.reduce((s, i) => s + (i.amount ?? 0), 0);
    const fobUsd = Math.max(0, (o.dollarAmount ?? 0) - o.shippingPrice);
    return o.items.map(item => {
      const rawTotal = totalItemInr > 0 && fobUsd > 0
        ? (item.amount ?? 0) / totalItemInr * fobUsd
        : item.inrUnit != null
          ? item.inrUnit * item.quantity / exchRate
          : item.sellingPrice * item.quantity;
      const total = Math.round(rawTotal * 100) / 100;
      const unit  = item.quantity > 0 ? Math.round(total / item.quantity * 100) / 100 : 0;
      return { ...item, usdUnit: unit, usdTotal: total };
    });
  });
  const totalQty = allItems.reduce((s, i) => s + i.quantity, 0);
  const invoiceLabel = orders.map(o => o.invoiceNo).filter(Boolean).join(" / ") || "—";

  const td:   React.CSSProperties = { border: "1px solid #000", padding: "3px 5px", verticalAlign: "top", fontSize: "9px" };
  const tdSm: React.CSSProperties = { ...td, fontSize: "8px" };
  const yw:   React.CSSProperties = { ...td };
  const tbl:  React.CSSProperties = { width: "100%", borderCollapse: "collapse" as const };

  return (
    <div style={{ fontFamily: "Arial,sans-serif", fontSize: "9px", color: "#000", background: "#fff", minWidth: 900 }}>
      <table style={tbl}><tbody><tr>
        <td style={{ ...td, textAlign: "center", fontWeight: "bold", fontSize: "14px", padding: "7px", letterSpacing: "0.08em" }}>EXPORT INVOICE</td>
      </tr></tbody></table>

      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup><col style={{ width: "8%" }}/><col style={{ width: "47%" }}/><col style={{ width: "22%" }}/><col style={{ width: "23%" }}/></colgroup>
        <tbody>
          <tr>
            <td style={td} rowSpan={6}><strong>Exporter<br/>Name &amp; Address</strong></td>
            <td style={{ ...td, fontWeight: "bold" }} rowSpan={6}>
              From: UNNATI PHARMAX<br/>SHOP NO 181 GURUKRUPA APARTMENT<br/>CENTRAL AVE<br/>LAKADGANJ NAGPUR<br/>MAHARSHTRA 440008
            </td>
            <td style={td}><strong>Invoice No.</strong></td>
            <td style={{ ...yw, fontWeight: "bold" }}>{invoiceLabel}</td>
          </tr>
          <tr><td style={td}><strong>Date</strong></td><td style={yw}>{dateStr}</td></tr>
          <tr><td style={td}>Buyer Reference :</td><td style={yw}>AS PER PACKING LIST</td></tr>
          <tr><td style={td}>Email Order</td><td style={yw}></td></tr>
          <tr><td style={td}>Other Reference:</td><td style={yw}></td></tr>
          <tr><td style={td}></td><td style={td} colSpan={2}></td></tr>
        </tbody>
      </table>

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
            <td style={{ ...yw, fontWeight: "bold" }}>AS PER PACKING LIST</td>
          </tr>
          <tr><td style={td}></td><td style={tdSm}>(As per Annexure/Packing List)</td><td style={td}></td><td style={td}></td></tr>
          <tr><td style={td}></td><td style={tdSm}>AS PER PACKING LIST / As per Annexure</td><td style={tdSm} colSpan={2}>Third Party Transfer</td></tr>
          <tr><td style={td}></td><td style={td}>Country of Origin: <strong>INDIA</strong></td><td style={td}>Country of final Destination:</td><td style={tdSm}>AS PER PACKING LIST</td></tr>
        </tbody>
      </table>

      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup><col style={{ width: "10%" }}/><col style={{ width: "14%" }}/><col style={{ width: "11%" }}/><col style={{ width: "14%" }}/><col style={{ width: "22%" }}/><col style={{ width: "15%" }}/><col style={{ width: "14%" }}/></colgroup>
        <tbody>
          <tr>
            <td style={td}><strong>Carriage by Air</strong></td>
            <td style={{ ...yw, fontWeight: "bold" }}>{first.shipmentMode ?? "EMS"}</td>
            <td style={td}>Place of Receipt by</td>
            <td style={tdSm}><span style={{ fontWeight: "bold" }}>Pre-carrier:</span> Mumbai</td>
            <td style={td} colSpan={2}>Terms of Delivery and payment</td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>CFR</td>
          </tr>
          <tr>
            <td style={td}><strong>Currency</strong></td>
            <td style={{ ...yw, fontWeight: "bold" }}>{first.currency}</td>
            <td style={td} colSpan={2}>Port of Loading: <strong>Mumbai</strong></td>
            <td style={tdSm}>END USE CODE : DCX900</td>
            <td style={tdSm} colSpan={2}>NATURE PAYMENT : ADVANCE PAYMENT</td>
          </tr>
          <tr>
            <td style={tdSm} colSpan={2}>Port of Discharge: <strong>AS PER PACKING LIST</strong></td>
            <td style={tdSm} colSpan={2}>Final Destination: <strong>AS PER PACKING LIST</strong></td>
            <td style={td}><strong>EXCHANGE RATE $</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }} colSpan={2}>{exchRate.toFixed(2)}</td>
          </tr>
          <tr>
            <td style={td} colSpan={4}></td>
            <td style={td}><strong>F.O.B INR</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }} colSpan={2}>{expFobInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style={td} colSpan={4}></td>
            <td style={td}><strong>C&amp;F AMOUNT INR :</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }} colSpan={2}>{expCnfInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "4%" }}/><col style={{ width: "8%" }}/><col style={{ width: "13%" }}/><col style={{ width: "12%" }}/>
          <col style={{ width: "6%" }}/><col style={{ width: "6%" }}/><col style={{ width: "8%" }}/><col style={{ width: "12%" }}/>
          <col style={{ width: "7%" }}/><col style={{ width: "5%" }}/><col style={{ width: "9%" }}/><col style={{ width: "10%" }}/>
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }}>Marks &amp; Nos</th>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }} colSpan={8}>Description of Goods</th>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }}>Unit</th>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }}>Price/unit</th>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }}>TOTAL PRICE</th>
          </tr>
          <tr>
            {["#","HS Code","Product Name","Generic Name","Mfd. Date","Exp.Date","Batch","Mfg by","Unit Packing","Unit","Price/unit ($)","TOTAL PRICE ($)"].map(h => (
              <th key={h} style={{ ...td, fontWeight: "bold", textAlign: "center", fontSize: "8px", background: "#ececec" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allItems.map((item, idx) => (
            <tr key={idx} style={{ textAlign: "center" }}>
              <td style={td}>{idx + 1}</td>
              <td style={td}>{item.hsn ?? ""}</td>
              <td style={{ ...td, textAlign: "left" }}>{item.productName}</td>
              <td style={{ ...td, textAlign: "left" }}>{item.composition ?? ""}</td>
              <td style={td}>{item.mfgDate ?? ""}</td>
              <td style={td}>{item.expDate ?? ""}</td>
              <td style={td}>{item.batchNo ?? ""}</td>
              <td style={{ ...td, textAlign: "left" }}>{item.manufacturer ?? ""}</td>
              <td style={td}>{item.pack ?? ""}</td>
              <td style={{ ...td, fontWeight: "bold" }}>{item.quantity}</td>
              <td style={{ ...td, textAlign: "right" }}>$ {item.usdUnit.toFixed(2)}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: "bold" }}>$ {item.usdTotal.toFixed(2)}</td>
            </tr>
          ))}
          <tr><td style={{ ...td, height: "10px" }} colSpan={12}></td></tr>
        </tbody>
      </table>

      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup><col style={{ width: "30%" }}/><col style={{ width: "8%" }}/><col style={{ width: "8%" }}/><col style={{ width: "8%" }}/><col style={{ width: "22%" }}/><col style={{ width: "12%" }}/><col style={{ width: "12%" }}/></colgroup>
        <tbody>
          <tr>
            <td style={{ ...yw, fontWeight: "bold", fontSize: "9px" }} colSpan={4}>TOTAL NO OF BOX = {orders.length}</td>
            <td style={td}></td>
            <td style={{ ...td, fontWeight: "bold", textAlign: "right" }}>TOTAL QTY</td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>{totalQty}</td>
          </tr>
          <tr>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>LP</td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>EMS</td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>CM</td>
            <td style={td}></td><td style={td}></td>
            <td style={td}><strong>Total (FOB)</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }}>$ {expFobUsd.toFixed(2)}</td>
          </tr>
          <tr>
            <td style={tdSm} colSpan={3}>Total article Qty</td>
            <td style={{ ...yw, textAlign: "center", fontWeight: "bold" }}>{totalQty}</td>
            <td style={{ ...td, fontWeight: "bold", textAlign: "center" }}>{first.currency}</td>
            <td style={td}><strong>Shipping Charges</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }}>$ {expShipUsd.toFixed(2)}</td>
          </tr>
          <tr>
            <td style={td} colSpan={5}></td>
            <td style={td}><strong>Total Amount (C &amp; F)</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }}>$ {expCnfUsd.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

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
            <td style={{ ...td, textAlign: "center", verticalAlign: "bottom", paddingBottom: "6px" }}>
              <br/><br/><br/>
              <strong>Authorised Signatory</strong><br/>
              <strong>UNNATI PHARMAX</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Multi-order: Export Invoice (INR) ────────────────────────────────────────
function MultiExportInvoiceINRDoc({ orders }: { orders: Order[] }) {
  const first    = orders[0];
  const exchRate = first.exchangeRate || 84;
  const invDate  = getInvoiceDate(first);
  const dateStr  = invDate.toLocaleDateString("en-GB").replaceAll("/", ".");

  const expCnfInr  = orders.reduce((s, o) => {
    const cnf = (o.inrAmount != null && o.inrAmount > 0) ? o.inrAmount : Math.round((o.dollarAmount ?? 0) * exchRate * 100) / 100;
    return s + cnf;
  }, 0);
  const expShipInr = orders.reduce((s, o) => s + Math.round(o.shippingPrice * exchRate * 100) / 100, 0);
  const expFobInr  = Math.max(0, expCnfInr - expShipInr);

  function itemInr(item: Item): { unit: number; total: number } {
    let total: number;
    if (item.amount != null && item.amount > 0)      total = item.amount;
    else if (item.inrUnit != null)                   total = Math.round(item.inrUnit * item.quantity * 100) / 100;
    else total = Math.round(item.sellingPrice * exchRate * item.quantity * 100) / 100;
    return { total: Math.round(total * 100) / 100, unit: item.quantity > 0 ? Math.round(total / item.quantity * 100) / 100 : 0 };
  }

  const allItems = orders.flatMap(o => o.items.map(item => ({ ...item, ...itemInr(item) })));
  const totalQty = allItems.reduce((s, i) => s + i.quantity, 0);
  const invoiceLabel = orders.map(o => o.invoiceNo).filter(Boolean).join(" / ") || "—";

  const td:   React.CSSProperties = { border: "1px solid #000", padding: "3px 5px", verticalAlign: "top", fontSize: "9px" };
  const tdSm: React.CSSProperties = { ...td, fontSize: "8px" };
  const yw:   React.CSSProperties = { ...td };
  const tbl:  React.CSSProperties = { width: "100%", borderCollapse: "collapse" as const };

  return (
    <div style={{ fontFamily: "Arial,sans-serif", fontSize: "9px", color: "#000", background: "#fff", minWidth: 900 }}>
      <table style={tbl}><tbody><tr>
        <td style={{ ...td, textAlign: "center", fontWeight: "bold", fontSize: "14px", padding: "7px", letterSpacing: "0.08em" }}>EXPORT INVOICE</td>
      </tr></tbody></table>

      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup><col style={{ width: "8%" }}/><col style={{ width: "47%" }}/><col style={{ width: "22%" }}/><col style={{ width: "23%" }}/></colgroup>
        <tbody>
          <tr>
            <td style={td} rowSpan={6}><strong>Exporter<br/>Name &amp; Address</strong></td>
            <td style={{ ...td, fontWeight: "bold" }} rowSpan={6}>
              From: UNNATI PHARMAX<br/>SHOP NO 181 GURUKRUPA APARTMENT<br/>CENTRAL AVE<br/>LAKADGANJ NAGPUR<br/>MAHARSHTRA 440008
            </td>
            <td style={td}><strong>Invoice No.</strong></td>
            <td style={{ ...yw, fontWeight: "bold" }}>{invoiceLabel}</td>
          </tr>
          <tr><td style={td}><strong>Date</strong></td><td style={yw}>{dateStr}</td></tr>
          <tr><td style={td}>Buyer Reference :</td><td style={yw}>AS PER PACKING LIST</td></tr>
          <tr><td style={td}>Email Order</td><td style={yw}></td></tr>
          <tr><td style={td}>Other Reference:</td><td style={yw}></td></tr>
          <tr><td style={td}></td><td style={td} colSpan={2}></td></tr>
        </tbody>
      </table>

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
            <td style={{ ...yw, fontWeight: "bold" }}>AS PER PACKING LIST</td>
          </tr>
          <tr><td style={td}></td><td style={tdSm}>(As per Annexure/Packing List)</td><td style={td}></td><td style={td}></td></tr>
          <tr><td style={td}></td><td style={tdSm}>AS PER PACKING LIST / As per Annexure</td><td style={tdSm} colSpan={2}>Third Party Transfer</td></tr>
          <tr><td style={td}></td><td style={td}>Country of Origin: <strong>INDIA</strong></td><td style={td}>Country of final Destination:</td><td style={tdSm}>AS PER PACKING LIST</td></tr>
        </tbody>
      </table>

      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup><col style={{ width: "10%" }}/><col style={{ width: "14%" }}/><col style={{ width: "11%" }}/><col style={{ width: "14%" }}/><col style={{ width: "22%" }}/><col style={{ width: "15%" }}/><col style={{ width: "14%" }}/></colgroup>
        <tbody>
          <tr>
            <td style={td}><strong>Carriage by Air</strong></td>
            <td style={{ ...yw, fontWeight: "bold" }}>{first.shipmentMode ?? "EMS"}</td>
            <td style={td}>Place of Receipt by</td>
            <td style={tdSm}><span style={{ fontWeight: "bold" }}>Pre-carrier:</span> Mumbai</td>
            <td style={td} colSpan={2}>Terms of Delivery and payment</td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>CFR</td>
          </tr>
          <tr>
            <td style={td}><strong>Currency</strong></td>
            <td style={{ ...yw, fontWeight: "bold" }}>INR</td>
            <td style={td} colSpan={2}>Port of Loading: <strong>Mumbai</strong></td>
            <td style={tdSm}>END USE CODE : DCX900</td>
            <td style={tdSm} colSpan={2}>NATURE PAYMENT : ADVANCE PAYMENT</td>
          </tr>
          <tr>
            <td style={tdSm} colSpan={2}>Port of Discharge: <strong>AS PER PACKING LIST</strong></td>
            <td style={tdSm} colSpan={2}>Final Destination: <strong>AS PER PACKING LIST</strong></td>
            <td style={td}><strong>EXCHANGE RATE ₹</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }} colSpan={2}>{exchRate.toFixed(2)}</td>
          </tr>
          <tr>
            <td style={td} colSpan={4}></td>
            <td style={td}><strong>F.O.B INR</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }} colSpan={2}>₹ {expFobInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style={td} colSpan={4}></td>
            <td style={td}><strong>C&amp;F AMOUNT INR :</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }} colSpan={2}>₹ {expCnfInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "4%" }}/><col style={{ width: "8%" }}/><col style={{ width: "13%" }}/><col style={{ width: "12%" }}/>
          <col style={{ width: "6%" }}/><col style={{ width: "6%" }}/><col style={{ width: "8%" }}/><col style={{ width: "12%" }}/>
          <col style={{ width: "7%" }}/><col style={{ width: "5%" }}/><col style={{ width: "9%" }}/><col style={{ width: "10%" }}/>
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }}>Marks &amp; Nos</th>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }} colSpan={8}>Description of Goods</th>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }}>Unit</th>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }}>Price/unit (₹)</th>
            <th style={{ ...td, fontWeight: "bold", textAlign: "center", background: "#d9d9d9", fontSize: "9px" }}>TOTAL PRICE (₹)</th>
          </tr>
          <tr>
            {["#","HS Code","Product Name","Generic Name","Mfd. Date","Exp.Date","Batch","Mfg by","Unit Packing","Unit","Price/unit (₹)","TOTAL PRICE (₹)"].map(h => (
              <th key={h} style={{ ...td, fontWeight: "bold", textAlign: "center", fontSize: "8px", background: "#ececec" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allItems.map((item, idx) => (
            <tr key={idx} style={{ textAlign: "center" }}>
              <td style={td}>{idx + 1}</td>
              <td style={td}>{item.hsn ?? ""}</td>
              <td style={{ ...td, textAlign: "left" }}>{item.productName}</td>
              <td style={{ ...td, textAlign: "left" }}>{item.composition ?? ""}</td>
              <td style={td}>{item.mfgDate ?? ""}</td>
              <td style={td}>{item.expDate ?? ""}</td>
              <td style={td}>{item.batchNo ?? ""}</td>
              <td style={{ ...td, textAlign: "left" }}>{item.manufacturer ?? ""}</td>
              <td style={td}>{item.pack ?? ""}</td>
              <td style={{ ...td, fontWeight: "bold" }}>{item.quantity}</td>
              <td style={{ ...td, textAlign: "right" }}>₹ {item.unit.toFixed(2)}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: "bold" }}>₹ {item.total.toFixed(2)}</td>
            </tr>
          ))}
          <tr><td style={{ ...td, height: "10px" }} colSpan={12}></td></tr>
        </tbody>
      </table>

      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup><col style={{ width: "30%" }}/><col style={{ width: "8%" }}/><col style={{ width: "8%" }}/><col style={{ width: "8%" }}/><col style={{ width: "22%" }}/><col style={{ width: "12%" }}/><col style={{ width: "12%" }}/></colgroup>
        <tbody>
          <tr>
            <td style={{ ...yw, fontWeight: "bold", fontSize: "9px" }} colSpan={4}>TOTAL NO OF BOX = {orders.length}</td>
            <td style={td}></td>
            <td style={{ ...td, fontWeight: "bold", textAlign: "right" }}>TOTAL QTY</td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>{totalQty}</td>
          </tr>
          <tr>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>LP</td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>EMS</td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "center" }}>CM</td>
            <td style={td}></td><td style={td}></td>
            <td style={td}><strong>Total (FOB)</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }}>₹ {expFobInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style={tdSm} colSpan={3}>Total article Qty</td>
            <td style={{ ...yw, textAlign: "center", fontWeight: "bold" }}>{totalQty}</td>
            <td style={{ ...td, fontWeight: "bold", textAlign: "center" }}>INR</td>
            <td style={td}><strong>Shipping Charges</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }}>₹ {expShipInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style={td} colSpan={5}></td>
            <td style={td}><strong>Total Amount (C &amp; F)</strong></td>
            <td style={{ ...yw, fontWeight: "bold", textAlign: "right" }}>₹ {expCnfInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

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
              GSTIN No : <strong>27FNXPP3883B1ZA</strong>
            </td>
            <td style={{ ...tdSm, lineHeight: "1.6" }}>
              <strong>Declaration:</strong><br/>
              We declare that this Invoice shows actual price of goods described and that all particulars are true and correct.
            </td>
            <td style={{ ...td, textAlign: "center", verticalAlign: "bottom", paddingBottom: "6px" }}>
              <br/><br/><br/>
              <strong>Authorised Signatory</strong><br/>
              <strong>UNNATI PHARMAX</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Multi-order: Packing List ─────────────────────────────────────────────────
function MultiPackingListDoc({ orders }: { orders: Order[] }) {
  const first   = orders[0];
  const invDate = getInvoiceDate(first);
  const dateStr = invDate.toLocaleDateString("en-GB").replaceAll("/", ".");
  const invoiceLabel = orders.map(o => o.invoiceNo).filter(Boolean).join(" / ") || "—";

  const BLK = "#000";
  const WHT = "#fff";
  const border = "1px solid #000";
  const base: React.CSSProperties = { border, padding: "3px 5px", verticalAlign: "top", color: BLK, fontSize: "9pt", background: WHT };
  const hdr:  React.CSSProperties = { ...base, fontWeight: "bold" };
  const th:   React.CSSProperties = { ...base, background: "#e8e8e8", fontWeight: "bold", textAlign: "center" as const, fontSize: "8.5pt", verticalAlign: "middle" as const };
  const td:   React.CSSProperties = { ...base };
  const tdc:  React.CSSProperties = { ...base, textAlign: "center" as const };
  const tbl:  React.CSSProperties = { width: "100%", borderCollapse: "collapse" as const };

  const COLS = ["Sr No","Customer","Product Name","Mfd. Date","Exp.Date","Batch No.","Mfg by.","Packing","Qty","Country","Zipcode","Tracking No","Weight(IN GMS)"];

  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: "9pt", color: BLK, background: WHT }}>
      <table style={tbl}><tbody>
        <tr><td style={{ ...hdr, textAlign: "center", fontSize: "17pt", padding: "6px 8px" }}>UNNATI PHARMAX</td></tr>
        <tr><td style={{ ...hdr, textAlign: "center", fontSize: "13pt", padding: "4px 8px" }}>PACKING LIST (Annexure)</td></tr>
      </tbody></table>

      <table style={tbl}>
        <colgroup>
          <col style={{ width: "12%" }}/><col style={{ width: "22%" }}/>
          <col/><col/><col/><col/>
        </colgroup>
        <tbody>
          {[
            ["IEC No :",    "FNXPP3883B"],
            ["Invoice No:", invoiceLabel],
            ["Date:",       dateStr],
            ["GST NO :",    "27FNXPP3883B1ZA"],
          ].map(([label, value]) => (
            <tr key={label}>
              <td style={hdr}>{label}</td>
              <td style={td}>{value}</td>
              <td style={td}></td><td style={td}></td><td style={td}></td><td style={td}></td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={tbl}>
        <colgroup>
          <col style={{ width: "4%" }}/><col style={{ width: "9%" }}/><col style={{ width: "17%" }}/>
          <col style={{ width: "7%" }}/><col style={{ width: "7%" }}/><col style={{ width: "9%" }}/>
          <col style={{ width: "14%" }}/><col style={{ width: "6%" }}/><col style={{ width: "4%" }}/>
          <col style={{ width: "8%" }}/><col style={{ width: "6%" }}/><col style={{ width: "9%" }}/><col style={{ width: "10%" }}/>
        </colgroup>
        <thead>
          <tr>{COLS.map(h => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {orders.map((order, srIdx) => {
            const totalWeightGms = order.netWeight != null ? Math.round(order.netWeight * 1000) : null;
            return order.items.map((item, itemIdx) => (
              <tr key={`${order.id}-${itemIdx}`}>
                {/* Sr No — spans all items for this order */}
                {itemIdx === 0 && (
                  <td rowSpan={order.items.length} style={{ ...tdc, verticalAlign: "middle" }}>{srIdx + 1}</td>
                )}
                {/* Customer — spans all items for this order */}
                {itemIdx === 0 && (
                  <td rowSpan={order.items.length} style={{ ...tdc, verticalAlign: "middle" }}>{order.fullName}</td>
                )}
                <td style={td}>{item.productName}</td>
                <td style={tdc}>{item.mfgDate ?? ""}</td>
                <td style={tdc}>{item.expDate ?? ""}</td>
                <td style={{ ...tdc, fontFamily: "monospace" }}>{item.batchNo ?? ""}</td>
                <td style={td}>{item.manufacturer ?? ""}</td>
                <td style={tdc}>{item.pack ?? ""}</td>
                <td style={{ ...tdc, fontWeight: "bold" }}>{item.quantity}</td>
                {/* Country / Zipcode / Tracking / Weight — span all items for this order */}
                {itemIdx === 0 && (
                  <td rowSpan={order.items.length} style={{ ...tdc, verticalAlign: "middle" }}>{order.country}</td>
                )}
                {itemIdx === 0 && (
                  <td rowSpan={order.items.length} style={{ ...tdc, verticalAlign: "middle", fontFamily: "monospace" }}>{order.postalCode}</td>
                )}
                {itemIdx === 0 && (
                  <td rowSpan={order.items.length} style={{ ...tdc, verticalAlign: "middle", fontFamily: "monospace" }}>{order.trackingNo ?? ""}</td>
                )}
                {itemIdx === 0 && (
                  <td rowSpan={order.items.length} style={{ ...tdc, verticalAlign: "middle" }}>
                    {totalWeightGms != null ? `${totalWeightGms} GMS` : ""}
                  </td>
                )}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Multi-order Documents Overlay ─────────────────────────────────────────────
function MultiDocumentsOverlay({ orders, onClose }: { orders: Order[]; onClose: () => void }) {
  const [ds, setDs]           = useState<DocSettings>(DOC_SETTINGS_DEFAULT);
  const [weightMap, setWeightMap] = useState<Record<string, number>>({});
  const [cn22Desc, setCn22Desc]   = useState("");
  useEffect(() => {
    fetch("/api/settings/company").then(r => r.json()).then(s => setDs({
      chaName: s.chaName || DOC_SETTINGS_DEFAULT.chaName,
      chaNo:   s.chaNo   || DOC_SETTINGS_DEFAULT.chaNo,
      stampB64: s.stampB64 || "",
      sigB64:   s.sigB64   || "",
      companyName:    s.name    || DOC_SETTINGS_DEFAULT.companyName,
      companyAddress: s.address || DOC_SETTINGS_DEFAULT.companyAddress,
    })).catch(() => {});
  }, []);

  // Apply weight overrides to each order
  const effectiveOrders = orders.map(o =>
    weightMap[o.id] != null ? { ...o, netWeight: weightMap[o.id], grossWeight: weightMap[o.id] } : o
  );
  const first = effectiveOrders[0];

  const docs = [
    { label: "Export Invoice",     landscape: true,  multiPage: true,  comp: <MultiExportInvoiceDoc    orders={effectiveOrders} /> },
    { label: "Export Invoice INR", landscape: true,  multiPage: true,  comp: <MultiExportInvoiceINRDoc orders={effectiveOrders} /> },
    { label: "Packing List",       landscape: true,  multiPage: true,  comp: <MultiPackingListDoc      orders={effectiveOrders} /> },
    { label: "Form II",           landscape: true,  multiPage: false, comp: <Form2Doc          order={first} /> },
    { label: "EDF",               landscape: true,  multiPage: false, comp: <EdfDoc            order={first} /> },
    { label: "Covering Letter",   landscape: false, multiPage: true,  comp: <CoveringLetterDoc order={first} chaName={ds.chaName} chaNo={ds.chaNo} /> },
    { label: "CN22 Label",        landscape: false, multiPage: false, comp: <CN22LabelDoc      order={first} companyName={ds.companyName} companyAddress={ds.companyAddress} customDesc={cn22Desc || undefined} /> },
  ];

  function handlePrint() {
    const root = document.getElementById("unnati-multi-docs-root");
    if (!root) return;
    const origin = window.location.origin;
    const html = root.innerHTML.replace(/src="\/([^"]+)"/g, `src="${origin}/$1"`);
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { alert("Pop-up blocked — allow pop-ups for this site and try again."); return; }
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<title>${orders.map(o => o.invoiceNo).filter(Boolean).join("-") || "Multi-Documents"}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { margin: 0; padding: 0; background: #fff; font-family: Arial, sans-serif; }
  .doc-section-label { display: none !important; }
  @page          { size: A4 portrait;  margin: 10mm; }
  @page landscape { size: A4 landscape; margin: 10mm; }
  .doc-section { width: 100%; height: 277mm; box-sizing: border-box; overflow: hidden; page-break-after: always; break-after: page; padding: 0; }
  .doc-section.landscape { page: landscape; height: 190mm; }
  .doc-section.multi-page { height: auto; overflow: visible; page-break-inside: auto; break-inside: auto; }
  .doc-section:last-child { page-break-after: auto; break-after: auto; }
</style></head><body>${html}</body></html>`);
    win.document.close();
    win.onafterprint = () => win.close();
    const imgs = win.document.images;
    if (imgs.length === 0) { win.focus(); win.print(); }
    else {
      let loaded = 0;
      Array.from(imgs).forEach(img => {
        const tryPrint = () => { loaded++; if (loaded >= imgs.length) { win.focus(); win.print(); } };
        if (img.complete) tryPrint(); else { img.onload = tryPrint; img.onerror = tryPrint; }
      });
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, overflowY: "auto" }}>
      <div style={{ maxWidth: 1160, margin: "20px auto", background: "#fff", padding: "0 0 40px" }}>
        <div style={{
          background: "#1a1a2e", color: "#fff", padding: "10px 20px",
          display: "flex", gap: 10, alignItems: "center",
          position: "sticky", top: 0, zIndex: 10, flexWrap: "wrap",
        }}>
          <span style={{ fontWeight: 700, marginRight: "auto" }}>
            {orders.length} orders combined &nbsp;·&nbsp; {docs.length} documents
          </span>
          <button onClick={handlePrint} style={{ padding: "6px 18px", background: "#27ae60", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
            Print All
          </button>
          <button onClick={onClose} style={{ padding: "6px 16px", background: "rgba(255,255,255,0.12)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
            ✕ Close
          </button>
        </div>

        {/* ── Per-order scale photo bars ── */}
        {orders.map(o => (
          <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#0f172a", paddingLeft: 20 }}>
            <span style={{ fontSize: "0.72rem", color: "#6b7280", minWidth: 120, flexShrink: 0 }}>
              {o.fullName} ({o.invoiceNo ?? "—"}):
            </span>
            <div style={{ flex: 1 }}>
              <WeightCaptureBar
                currentWeight={o.netWeight}
                onExtracted={kg => setWeightMap(prev => ({ ...prev, [o.id]: kg }))}
              />
            </div>
          </div>
        ))}

        {/* ── CN22 label description input ── */}
        <div style={{
          background: "#1a1a2e", borderBottom: "1px solid #374151",
          padding: "7px 20px", display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#9ca3af", whiteSpace: "nowrap" }}>
            📦 Label description:
          </span>
          <input
            type="text"
            value={cn22Desc}
            onChange={e => setCn22Desc(e.target.value)}
            placeholder="Auto-generated from product names…"
            style={{
              flex: 1, padding: "4px 10px", fontSize: "0.8rem",
              background: "#0f172a", color: "#f1f5f9",
              border: "1px solid #374151", borderRadius: 5, outline: "none",
            }}
          />
          {cn22Desc && (
            <button
              onClick={() => setCn22Desc("")}
              style={{ padding: "3px 10px", fontSize: "0.75rem", background: "rgba(255,255,255,0.08)", color: "#9ca3af", border: "none", borderRadius: 4, cursor: "pointer" }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        <div id="unnati-multi-docs-root" style={{ background: "#fff", color: "#000" }}>
          <style>{`
            #unnati-multi-docs-root, #unnati-multi-docs-root * { color: #000 !important; -webkit-text-fill-color: #000 !important; opacity: 1 !important; text-shadow: none !important; }
            #unnati-multi-docs-root { background: #e5e7eb !important; padding: 0 !important; }
            #unnati-multi-docs-root table { width: 100%; border-collapse: collapse; }
            #unnati-multi-docs-root td, #unnati-multi-docs-root th { border-color: #000 !important; }
            #unnati-multi-docs-root thead { background: transparent !important; }
            #unnati-multi-docs-root tbody tr { background: transparent !important; border-bottom: none !important; }
            #unnati-multi-docs-root tbody tr:hover { background: transparent !important; }
            .doc-section-label { background: #374151 !important; color: #d1d5db !important; -webkit-text-fill-color: #d1d5db !important; font-size: 10px; font-weight: 600; padding: 5px 16px; letter-spacing: 0.06em; text-transform: uppercase; width: 210mm; margin: 0 auto; box-sizing: border-box; }
            .doc-section-label.landscape { width: 277mm; }
            .doc-section { width: 210mm; height: 277mm; margin: 0 auto 24px; padding: 10mm; background: #fff !important; box-sizing: border-box; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.25); }
            .doc-section.landscape { width: 277mm; height: 190mm; }
            .doc-section.multi-page { height: auto; min-height: 277mm; overflow: visible; }
            .doc-section.landscape.multi-page { min-height: 190mm; }
          `}</style>

          {docs.map(({ label, comp, landscape, multiPage }, i) => {
            const secCls = ["doc-section", landscape && "landscape", multiPage && "multi-page"].filter(Boolean).join(" ");
            const lblCls = ["doc-section-label", landscape && "landscape"].filter(Boolean).join(" ");
            return (
              <React.Fragment key={i}>
                <div className={lblCls}>{i + 1} / {docs.length} — {label}</div>
                <div className={secCls}>{comp}</div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Inline weight-capture bar (used inside doc overlays) ─────────────────────
// Lets the user upload a weighing-machine photo; AI reads the weight and the
// parent passes it down to all document components via weightKg override.
function WeightCaptureBar({
  currentWeight,
  onExtracted,
}: {
  currentWeight: number | null;
  onExtracted: (kg: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview,    setPreview]    = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [err,        setErr]        = useState("");
  const [captured,   setCaptured]   = useState<number | null>(null);

  const displayed = captured ?? currentWeight;

  async function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = async e => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      const mime   = file.type || "image/jpeg";
      setExtracting(true);
      setErr("");
      try {
        const res  = await fetch("/api/packaging/extract-weight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType: mime }),
        });
        const data = await res.json();
        if (!res.ok || data.netWeight == null) {
          setErr(data?.error || "Could not read weight — enter manually");
        } else {
          setCaptured(data.netWeight);
          onExtracted(data.netWeight);
        }
      } catch {
        setErr("Network error during weight extraction");
      }
      setExtracting(false);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div style={{
      background: "#111827",
      borderBottom: "1px solid #374151",
      padding: "8px 20px",
      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
    }}>
      {/* Label */}
      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#9ca3af" }}>
        ⚖ Scale photo:
      </span>

      {/* Thumbnail */}
      {preview && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={preview} alt="scale" style={{ height: 36, width: 52, objectFit: "cover", borderRadius: 4 }} />
      )}

      {/* Status */}
      {extracting ? (
        <span style={{ fontSize: "0.78rem", color: "#f59e0b" }}>Reading scale…</span>
      ) : captured != null ? (
        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#10b981" }}>✓ {captured} kg</span>
      ) : currentWeight != null ? (
        <span style={{ fontSize: "0.78rem", color: "#6ee7b7" }}>Stored: {currentWeight} kg</span>
      ) : (
        <span style={{ fontSize: "0.75rem", color: "#f87171" }}>No weight recorded</span>
      )}

      {err && <span style={{ fontSize: "0.73rem", color: "#f87171" }}>{err}</span>}

      {/* Upload button */}
      <button
        onClick={() => fileRef.current?.click()}
        style={{
          padding: "4px 12px", fontSize: "0.78rem", fontWeight: 600,
          background: displayed != null ? "rgba(255,255,255,0.08)" : "#f59e0b",
          color: displayed != null ? "#d1d5db" : "#000",
          border: "none", borderRadius: 5, cursor: "pointer",
        }}
      >
        {displayed != null ? "Re-upload" : "Upload scale photo"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />

      {displayed != null && (
        <span style={{ fontSize: "0.72rem", color: "#6b7280", marginLeft: "auto" }}>
          Weight used in all documents: <strong style={{ color: "#d1d5db" }}>{displayed} kg ({Math.round(displayed * 1000)} g)</strong>
        </span>
      )}
    </div>
  );
}

// ── Documents overlay — all docs stacked, single print/download ───────────────
type DocSettings = { chaName: string; chaNo: string; stampB64: string; sigB64: string; companyName: string; companyAddress: string; };
const DOC_SETTINGS_DEFAULT: DocSettings = { chaName: "AARPEE CLEARING & LOGISTICS", chaNo: "11/2623", stampB64: "", sigB64: "", companyName: "UNNATI PHARMAX", companyAddress: "1/04 Guruvanada Appartment, Central Ave, Lakadganj, Nagpur 440008" };

function DocumentsOverlay({ order, labelOverrides, onClose }: { order: Order; labelOverrides?: LabelOverrides; onClose: () => void }) {
  const isDHL        = order.shipmentMode === "DHL";
  const downloadHref = `/api/packaging/orders/${order.id}/documents`;

  const [ds, setDs] = useState<DocSettings>(DOC_SETTINGS_DEFAULT);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const o = weightKg != null ? { ...order, netWeight: weightKg, grossWeight: weightKg } : order;

  useEffect(() => {
    fetch("/api/settings/company").then(r => r.json()).then(s => setDs({
      chaName: s.chaName || DOC_SETTINGS_DEFAULT.chaName,
      chaNo:   s.chaNo   || DOC_SETTINGS_DEFAULT.chaNo,
      stampB64: s.stampB64 || "",
      sigB64:   s.sigB64   || "",
      companyName:    s.name    || DOC_SETTINGS_DEFAULT.companyName,
      companyAddress: s.address || DOC_SETTINGS_DEFAULT.companyAddress,
    })).catch(() => {});
  }, []);

  // landscape: print in A4 landscape (297×210mm) — for wide tables
  // multiPage: allow content to flow to a second page instead of being clipped
  const nonDHLDocs = [
    { label: "Export Invoice",     landscape: true,  multiPage: false, comp: <ExportInvoiceDoc    order={o} /> },
    { label: "Export Invoice INR", landscape: true,  multiPage: false, comp: <ExportInvoiceINRDoc order={o} /> },
    { label: "Packing List",       landscape: true,  multiPage: false, comp: <PackingListDoc      order={o} /> },
    { label: "Form II",           landscape: true,  multiPage: false, comp: <Form2Doc          order={o} /> },
    { label: "EDF",               landscape: true,  multiPage: false, comp: <EdfDoc            order={o} /> },
    { label: "Covering Letter",   landscape: false, multiPage: true,  comp: <CoveringLetterDoc order={o} chaName={ds.chaName} chaNo={ds.chaNo} /> },
    { label: "CN22 Label",        landscape: false, multiPage: false, comp: <CN22LabelDoc      order={o} companyName={ds.companyName} companyAddress={ds.companyAddress} customDesc={labelOverrides?.desc || undefined} customValue={labelOverrides?.value ? Number(labelOverrides.value) : undefined} customCurrency={labelOverrides?.currency || undefined} customHsn={labelOverrides?.hsn || undefined} /> },
  ];

  const dhlDocs = [
    { label: "DHL Invoice",          landscape: false, multiPage: false, comp: <DHLInvoiceDoc    order={order} /> },
    { label: "DHL Packing List",     landscape: true,  multiPage: false, comp: <DHLPackingDoc    order={order} /> },
    { label: "ADC Sheet",            landscape: false, multiPage: false, comp: <DHLAdcDoc        order={order} /> },
    { label: "Shipper's Letter",     landscape: false, multiPage: false, comp: <DHLShipperDoc    order={order} /> },
    { label: "Export Declaration",   landscape: false, multiPage: true,  comp: <DHLExportDeclDoc order={order} /> },
    { label: "Custom Declaration",   landscape: false, multiPage: false, comp: <DHLCustomDeclDoc order={order} /> },
    { label: "Authorization Letter", landscape: false, multiPage: false, comp: <DHLAuthDoc       order={order} /> },
    { label: "Non-DGR Certificate",  landscape: false, multiPage: false, comp: <DHLNonDgrDoc     order={order} /> },
  ];

  const docs = isDHL ? dhlDocs : nonDHLDocs;

  // Open a clean new window with just the document HTML and print from there.
  // This avoids all overlay/fixed-positioning/visibility-hack issues that cause
  // blank pages, side-clipping, and broken pagination.
  function handlePrint() {
    const root = document.getElementById("unnati-docs-root");
    if (!root) return;

    // Fix relative image src paths to absolute so they load in the new window
    const origin = window.location.origin;
    const html = root.innerHTML.replace(/src="\/([^"]+)"/g, `src="${origin}/$1"`);

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { alert("Pop-up blocked — allow pop-ups for this site and try again."); return; }

    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${order.invoiceNo ?? "Documents"}</title>
<style>
  *, *::before, *::after {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body { margin: 0; padding: 0; background: #fff; font-family: Arial, sans-serif; }
  .doc-section-label { display: none !important; }

  /* Default: portrait, single page */
  @page          { size: A4 portrait;  margin: 10mm; }
  @page landscape { size: A4 landscape; margin: 10mm; }

  .doc-section {
    width: 100%;
    height: 277mm;
    box-sizing: border-box;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
    padding: 0;
  }
  /* Landscape: 297mm wide × 190mm tall content area */
  .doc-section.landscape {
    page: landscape;
    height: 190mm;
  }
  /* Multi-page: let content flow naturally; page-break-after still ends the section */
  .doc-section.multi-page {
    height: auto;
    overflow: visible;
    page-break-inside: auto;
    break-inside: auto;
  }
  .doc-section:last-child {
    page-break-after: auto;
    break-after: auto;
  }
</style>
</head>
<body>${html}</body>
</html>`);
    win.document.close();

    // Close window only after the print dialog is dismissed
    win.onafterprint = () => win.close();

    // Wait for images to load before printing
    const imgs = win.document.images;
    if (imgs.length === 0) {
      win.focus();
      win.print();
    } else {
      let loaded = 0;
      const total = imgs.length;
      const tryPrint = () => {
        loaded++;
        if (loaded >= total) { win.focus(); win.print(); }
      };
      Array.from(imgs).forEach(img => {
        if (img.complete) { tryPrint(); }
        else { img.onload = tryPrint; img.onerror = tryPrint; }
      });
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, overflowY: "auto" }}>
      <div style={{ maxWidth: 1160, margin: "20px auto", background: "#fff", padding: "0 0 40px" }}>

        {/* ── Control bar ── */}
        <div style={{
          background: "#1a1a2e", color: "#fff",
          padding: "10px 20px",
          display: "flex", gap: 10, alignItems: "center",
          position: "sticky", top: 0, zIndex: 10, flexWrap: "wrap",
        }}>
          <span style={{ fontWeight: 700, marginRight: "auto" }}>
            {order.invoiceNo ?? "—"} &nbsp;·&nbsp; {docs.length} documents
          </span>
          <button
            onClick={handlePrint}
            style={{ padding: "6px 18px", background: "#27ae60", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
          >
            🖨 Print All
          </button>
          <a
            href={downloadHref}
            style={{ padding: "6px 18px", background: "#2563eb", color: "#fff", borderRadius: 6, cursor: "pointer", fontWeight: 600, textDecoration: "none" }}
          >
            ⬇ Download All
          </a>
          <button
            onClick={onClose}
            style={{ padding: "6px 16px", background: "rgba(255,255,255,0.12)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
          >
            ✕ Close
          </button>
        </div>

        {/* ── Scale photo / weight capture bar ── */}
        <WeightCaptureBar
          currentWeight={order.netWeight}
          onExtracted={kg => setWeightKg(kg)}
        />

        {/* ── All documents stacked (screen view) ── */}
        <div id="unnati-docs-root" style={{ background: "#fff", color: "#000" }}>
          <style>{`
            /* Force ERP dark-theme overrides back to black text on white for all doc content */
            #unnati-docs-root, #unnati-docs-root * {
              color: #000 !important;
              -webkit-text-fill-color: #000 !important;
              opacity: 1 !important;
              text-shadow: none !important;
            }
            #unnati-docs-root { background: #e5e7eb !important; padding: 0 !important; }
            #unnati-docs-root table { width: 100%; border-collapse: collapse; }
            #unnati-docs-root td, #unnati-docs-root th { border-color: #000 !important; }
            /* Reset global dark-theme table backgrounds */
            #unnati-docs-root thead { background: transparent !important; }
            #unnati-docs-root tbody tr { background: transparent !important; border-bottom: none !important; }
            #unnati-docs-root tbody tr:hover { background: transparent !important; }

            /* Screen-only section label */
            .doc-section-label {
              background: #374151 !important;
              color: #d1d5db !important;
              -webkit-text-fill-color: #d1d5db !important;
              font-size: 10px;
              font-weight: 600;
              padding: 5px 16px;
              letter-spacing: 0.06em;
              text-transform: uppercase;
              width: 210mm;
              margin: 0 auto;
              box-sizing: border-box;
            }
            .doc-section-label.landscape { width: 277mm; }

            /* Portrait single-page (default) */
            .doc-section {
              width: 210mm;
              height: 277mm;
              margin: 0 auto 24px;
              padding: 10mm;
              background: #fff !important;
              box-sizing: border-box;
              overflow: hidden;
              box-shadow: 0 2px 10px rgba(0,0,0,0.25);
            }
            /* Landscape: A4 rotated — 277mm wide, 190mm tall */
            .doc-section.landscape {
              width: 277mm;
              height: 190mm;
            }
            /* Multi-page: no height cap, content flows naturally */
            .doc-section.multi-page {
              height: auto;
              min-height: 277mm;
              overflow: visible;
            }
            .doc-section.landscape.multi-page {
              min-height: 190mm;
            }
          `}</style>

          {docs.map(({ label, comp, landscape, multiPage }, i) => {
            const secCls  = ["doc-section",       landscape && "landscape", multiPage && "multi-page"].filter(Boolean).join(" ");
            const lblCls  = ["doc-section-label", landscape && "landscape"].filter(Boolean).join(" ");
            return (
              // Fragment keeps label + section as siblings so :last-child works correctly
              <React.Fragment key={i}>
                <div className={lblCls}>
                  {i + 1} / {docs.length} — {label}
                </div>
                <div className={secCls}>
                  {comp}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── DHL Document Components ───────────────────────────────────────────────────
function dhlDateSlash(order: Order) {
  const d = getInvoiceDate(order);
  return d.toLocaleDateString("en-GB"); // DD/MM/YYYY
}
function dhlConsignee(order: Order) {
  return [order.fullName, order.address, [order.city, order.state].filter(Boolean).join(", "), `${order.postalCode} ${order.country}`.trim()].filter(Boolean);
}
const IEC = "FNXPP3883B", GSTIN = "27FNXPP3883B1ZA";
const tdS = { border: "1px solid #000", padding: "3px 6px" } as const;
const thS = { ...tdS, background: "#eee", fontWeight: 700 } as const;

function DHLInvoiceDoc({ order }: { order: Order }) {
  const date = dhlDateSlash(order); const totalUsd = order.totalUsd ?? 0;
  return (
    <div style={{ fontFamily: "Arial,sans-serif", fontSize: "8.5pt", padding: "10mm" }}>
      <h2 style={{ textAlign: "center", fontSize: "11pt" }}>EXPORTS INVOICE</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8, fontSize: "8pt" }}><tbody>
        <tr>
          <td style={{ width: "50%", verticalAlign: "top" }}>
            <strong>UNNATI PHARMAX</strong><br />Ground Floor House No 307/4, Guru Vandana Apartment,<br />Kakasaheb Cholkar Marg, Lakadganj, Nagpur 440008<br />
            IEC: {IEC} | GSTIN: {GSTIN}
          </td>
          <td style={{ width: "50%", verticalAlign: "top", textAlign: "right" }}>
            <strong>INVOICE NO:</strong> {order.invoiceNo}<br />
            <strong>DATE:</strong> {date}<br />
            <strong>WAY BILL:</strong> {order.trackingNo ?? "—"}
          </td>
        </tr>
      </tbody></table>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8, fontSize: "8pt" }}><tbody>
        <tr>
          <td style={{ ...tdS, width: "50%", verticalAlign: "top" }}><strong>Consignee:</strong><br />{dhlConsignee(order).map((l,i) => <span key={i}>{l}<br /></span>)}</td>
          <td style={{ ...tdS, width: "50%", verticalAlign: "top" }}><strong>BUYER:</strong> {order.remitterName}<br /><strong>ORIGIN:</strong> INDIA<br /><strong>DESTINATION:</strong> {order.country}<br /><strong>DELIVERY TERMS:</strong> C&F | <strong>PAYMENT:</strong> AD</td>
        </tr>
      </tbody></table>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "7.5pt" }}>
        <thead><tr>
          {["SR.","PARTICULARS","DRUG CONTENT","HSN","PACK","MFG DATE","EXP DATE","BATCH NO","QTY","UNIT USD","TOTAL USD"].map(h => <th key={h} style={thS}>{h}</th>)}
        </tr></thead>
        <tbody>
          {order.items.map((item, i) => {
            const lineUsd = item.inrUnit != null ? item.inrUnit * item.quantity / order.exchangeRate : 0;
            return (<tr key={i}>
              <td style={{ ...tdS, textAlign: "center" }}>{i+1}</td>
              <td style={tdS}>{item.productName}</td>
              <td style={tdS}>{item.composition ?? ""}</td>
              <td style={{ ...tdS, textAlign: "center" }}>{item.hsn ?? ""}</td>
              <td style={{ ...tdS, textAlign: "center" }}>{item.pack ?? ""}</td>
              <td style={{ ...tdS, textAlign: "center" }}>{item.mfgDate ?? ""}</td>
              <td style={{ ...tdS, textAlign: "center" }}>{item.expDate ?? ""}</td>
              <td style={{ ...tdS, fontFamily: "monospace", textAlign: "center" }}>{item.batchNo ?? ""}</td>
              <td style={{ ...tdS, textAlign: "center" }}>{item.quantity}</td>
              <td style={{ ...tdS, textAlign: "right" }}>{lineUsd > 0 ? (lineUsd / item.quantity).toFixed(6) : ""}</td>
              <td style={{ ...tdS, textAlign: "right" }}>{lineUsd > 0 ? lineUsd.toFixed(1) : ""}</td>
            </tr>);
          })}
        </tbody>
        <tfoot>
          <tr><td colSpan={9} style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>TOTAL FOB VALUE</td><td colSpan={2} style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{totalUsd.toFixed(0)}</td></tr>
          <tr><td colSpan={9} style={{ ...tdS, textAlign: "right" }}>FREIGHT</td><td colSpan={2} style={{ ...tdS, textAlign: "right" }}>0</td></tr>
          <tr><td colSpan={9} style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>TOTAL VALUE WITH FREIGHT</td><td colSpan={2} style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{totalUsd.toFixed(0)}</td></tr>
        </tfoot>
      </table>
      <p style={{ fontSize: "8pt" }}>Net Weight: <strong>{order.netWeight ?? "—"} kg</strong> &nbsp;|&nbsp; Gross Weight: <strong>{order.grossWeight ?? "—"} kg</strong></p>
      <p style={{ textAlign: "right", marginTop: 20, fontSize: "8pt" }}><strong>AUTHORISED SIGNATORY FOR UNNATI PHARMAX</strong></p>
    </div>
  );
}

function DHLPackingDoc({ order }: { order: Order }) {
  const date = dhlDateSlash(order);
  return (
    <div style={{ fontFamily: "Arial,sans-serif", fontSize: "8.5pt", padding: "10mm" }}>
      <h2 style={{ textAlign: "center" }}>Packing List</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8, fontSize: "8.5pt" }}><tbody>
        <tr><td style={{ fontWeight: 700 }}>Invoice No.</td><td style={{ background: "#ffff00", fontWeight: 700 }}>{order.invoiceNo}</td></tr>
        <tr><td style={{ fontWeight: 700 }}>Date :-</td><td style={{ background: "#ffff00", fontWeight: 700 }}>{date}</td></tr>
      </tbody></table>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt" }}>
        <thead><tr style={{ background: "#ffff00" }}>
          {["SR.NO","CUSTOMER NAME","Product Name","packing","Manufacturer","Batch No","Exp date","QTY","Shipping","country"].map(h => <th key={h} style={tdS}>{h}</th>)}
        </tr></thead>
        <tbody>{order.items.map((item, i) => (
          <tr key={i} style={{ background: "#ffff00" }}>
            <td style={{ ...tdS, textAlign: "center" }}>{i+1}</td>
            <td style={tdS}>{order.fullName}</td>
            <td style={{ ...tdS, fontWeight: 700 }}>{item.productName}</td>
            <td style={{ ...tdS, textAlign: "center" }}>{item.pack ?? ""}</td>
            <td style={tdS}>{item.manufacturer ?? ""}</td>
            <td style={{ ...tdS, fontFamily: "monospace", textAlign: "center" }}>{item.batchNo ?? ""}</td>
            <td style={{ ...tdS, textAlign: "center" }}>{item.expDate ?? ""}</td>
            <td style={{ ...tdS, textAlign: "center", fontWeight: 700 }}>{item.quantity}.00</td>
            <td style={{ ...tdS, textAlign: "center" }}>DHL</td>
            <td style={{ ...tdS, textAlign: "center" }}>{order.country}</td>
          </tr>
        ))}</tbody>
      </table>
      <p style={{ marginTop: 10, fontSize: "8pt" }}><strong>Consignee:</strong><br />{dhlConsignee(order).map((l,i) => <span key={i}>{l}<br /></span>)}</p>
    </div>
  );
}

function DHLAdcDoc({ order }: { order: Order }) {
  const date = dhlDateSlash(order); const awb = order.trackingNo ?? "";
  return (
    <div style={{ fontFamily: "Arial,sans-serif", fontSize: "8pt", padding: "8mm" }}>
      <p style={{ textAlign: "center", margin: "0 0 4px" }}>Government of India<br />Ministry of Health &amp; Family Welfare, Directorate General of Health Services,<br />O/o Asst. Drugs Controller, Central Drugs Standard Control Organization<br /><strong>PORT OFFICE</strong><br />International Air Cargo Complex, Sahar Village, Andheri, Mumbai - 400 099.</p>
      <h3 style={{ textAlign: "center" }}>ADC (I) SHEET FOR EXPORT</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6, fontSize: "7.5pt" }}><tbody>
        <tr><td style={{ width: "30%" }}><strong>ADC Entry No.</strong></td><td></td><td><strong>Shipping Bill No &amp; Date</strong></td><td style={{ color: "blue", fontWeight: 700 }}>{awb} &amp; {date}</td></tr>
        <tr><td><strong>IEC Number</strong></td><td style={{ fontWeight: 700 }}>{IEC}</td><td></td><td></td></tr>
      </tbody></table>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6, fontSize: "7.5pt" }}><tbody>
        <tr>
          <td style={{ width: "20%", verticalAlign: "top" }}><strong>Port of Loading</strong><br />AIR CARGO SHARA MUMBAI</td>
          <td style={{ width: "40%", verticalAlign: "top" }}><strong>Name &amp; Address of Exporter:</strong><br />UNNATI PHARMAX<br />Ground Floor House No 307/4, Guru Vandana Apartment,<br />Kakasaheb Cholkar Marg, Lakadganj, Nagpur 440008</td>
          <td style={{ width: "40%", verticalAlign: "top", border: "1px solid #000", padding: 4 }}><strong>Name &amp; Address of Consignee:</strong><br />{dhlConsignee(order).map((l,i) => <span key={i}>{l}<br /></span>)}</td>
        </tr>
      </tbody></table>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "7.5pt" }}>
        <thead><tr style={{ background: "#eee" }}>
          {["S.No.","Invoice No/ Date","Name of the Product","Batch No","Mfg. Date","Exp. Date","Total Export Qty","ADC Sample Qty","DSL/DML No","FOB Value INR","Remarks"].map(h => <th key={h} style={tdS}>{h}</th>)}
        </tr></thead>
        <tbody>{order.items.map((item, i) => (
          <tr key={i}>
            <td style={{ ...tdS, textAlign: "center" }}>{i+1}</td>
            <td style={tdS}>{i === 1 ? `${order.invoiceNo} & ${date}` : ""}</td>
            <td style={{ ...tdS, fontWeight: 700, color: "#ff8c00" }}>{item.productName}</td>
            <td style={{ ...tdS, fontFamily: "monospace", textAlign: "center" }}>{item.batchNo ?? ""}</td>
            <td style={{ ...tdS, textAlign: "center" }}>{item.mfgDate ?? ""}</td>
            <td style={{ ...tdS, textAlign: "center" }}>{item.expDate ?? ""}</td>
            <td style={{ ...tdS, textAlign: "center", fontWeight: 700 }}>{item.quantity}</td>
            <td style={tdS}></td><td style={tdS}></td>
            <td style={{ ...tdS, textAlign: "right" }}>{i === 1 ? (order.totalUsd ?? 0).toLocaleString("en-IN") : ""}</td>
            <td style={tdS}></td>
          </tr>
        ))}</tbody>
      </table>
      <table style={{ marginTop: 10, width: "100%", fontSize: "7.5pt" }}><tbody>
        <tr>
          <td style={{ width: "50%", verticalAlign: "top" }}>M/S KAUSHIK PATEL<br />1. Shipping Bill : &nbsp; 2. Invoice : &nbsp; 3. Packing List :<br />4. Certificate of Analysis : &nbsp; 5. Sample : &nbsp; 6. Drug Licence :</td>
          <td style={{ width: "50%", textAlign: "right" }}><strong>AUTHORISED SIGNATORY</strong><br />1 Receiving Time &nbsp; 2 Verified. Time<br />3 Released Time &nbsp; 4 Out Time</td>
        </tr>
      </tbody></table>
    </div>
  );
}

function DHLShipperDoc({ order }: { order: Order }) {
  const date = dhlDateSlash(order); const awb = order.trackingNo ?? "";
  const hl = { background: "#ffff00", fontWeight: 700 };
  return (
    <div style={{ fontFamily: "Arial,sans-serif", fontSize: "8pt", padding: "10mm" }}>
      <h3 style={{ textAlign: "center", background: "#ffff00", padding: 4 }}>SHIPPER'S LETTER OF INSTRUCTIONS</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6 }}><tbody>
        <tr><td style={{ width: "30%" }}><strong>Shipper Name:</strong></td><td style={hl}>UNNATI PHARMAX</td><td><strong>Invoice No.:</strong></td><td style={hl}>{order.invoiceNo}</td></tr>
        <tr><td><strong>Consignee Name:</strong></td><td style={hl}>{order.fullName}</td><td><strong>Invoice Date:</strong></td><td style={hl}>{date}</td></tr>
      </tbody></table>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6 }}><tbody>
        <tr><td style={{ width: "40%" }}><strong>DHL AIR WAYBILL NUMBER (AWB):</strong></td><td style={{ ...hl, ...{} as any }} colSpan={3}>{awb}</td></tr>
        <tr><td><strong>IE CODE NO:</strong></td><td style={hl}>{IEC}</td><td><strong>PAN NUMBER:</strong></td><td style={hl}>{IEC}</td></tr>
        <tr><td><strong>GSTIN NUMBER:</strong></td><td style={{ ...hl, ...{} as any }} colSpan={3}>{GSTIN}</td></tr>
      </tbody></table>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6, fontSize: "7.5pt" }}><tbody>
        <tr><td><strong>LUT - Export Under Bond</strong></td><td style={hl}>YES</td><td><strong>INCOTERMS:</strong></td><td style={hl}>C&F</td></tr>
        <tr><td><strong>FOB VALUE</strong></td><td style={hl}>{order.totalUsd ?? 0}</td><td><strong>NO. OF PKGS.</strong></td><td style={hl}>1</td></tr>
        <tr><td><strong>NET WT. (kg)</strong></td><td style={hl}>{order.netWeight ?? "—"}</td><td><strong>GROSS WT. (kg)</strong></td><td style={hl}>{order.grossWeight ?? "—"}</td></tr>
        <tr><td><strong>STATE OF ORIGIN</strong></td><td style={hl}>MAHARASHTRA</td><td><strong>DISTRICT OF ORIGIN</strong></td><td style={hl}>MAHARASHTRA</td></tr>
        <tr><td><strong>CATEGORY OF SHIPPER</strong></td><td style={hl}>Merchant</td><td><strong>Manufacturer:</strong></td><td style={hl}>HETER PHARMA</td></tr>
        <tr><td><strong>NATURE OF PAYMENT</strong></td><td style={hl}>AD</td><td></td><td></td></tr>
      </tbody></table>
      <p style={{ textAlign: "right", marginTop: 20 }}><strong>SIGNATURE OF EXPORTER / STAMP</strong></p>
    </div>
  );
}

function DHLExportDeclDoc({ order }: { order: Order }) {
  const date = dhlDateSlash(order);
  return (
    <div style={{ fontFamily: "Arial,sans-serif", fontSize: "11pt", padding: "20mm", lineHeight: 1.8 }}>
      <h2 style={{ textAlign: "center" }}>DECLARATION</h2>
      <p>I/We declare that the particulars given herein above are true, correct and complete.<br />I/We enclose herewith copies of the following documents*.</p>
      <ol><li>Duty Exemption Entitlement Certificate / Advance Authorisation / Duty Free Import Authorisation Declaration</li><li>Invoice / Invoice cum packing list</li><li>Quota / Inspection certificates</li><li>Others (Specify)</li></ol>
      <table style={{ borderCollapse: "collapse" }}><tbody>
        <tr><td style={tdS}>Name of the Exporter:</td><td style={tdS}><strong>UNNATI PHARMAX</strong></td><td style={tdS}>Name of Customs Broker:</td><td style={tdS}></td></tr>
        <tr><td style={tdS}>Designation</td><td style={tdS}><strong>KAUSHIK PATEL</strong></td><td style={tdS}>Designation</td><td style={tdS}></td></tr>
        <tr><td colSpan={2} style={tdS}></td><td style={tdS}>Identity Card Number</td><td style={tdS}></td></tr>
      </tbody></table>
      <p>I/We undertake to abide by the provisions of Foreign Exchange Management Act, 1999, as amended from time to time.</p>
      <br /><br />
      <p>Date <strong style={{ background: "#ffff00" }}>{date}</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Signature:………………………..&quot;;</p>
    </div>
  );
}

function DHLCustomDeclDoc({ order }: { order: Order }) {
  const date = dhlDateSlash(order); const awb = order.trackingNo ?? "";
  const productNames = order.items.map(i => i.productName).join(", ");
  return (
    <div style={{ fontFamily: "Arial,sans-serif", fontSize: "11pt", padding: "20mm", lineHeight: 1.8 }}>
      <p style={{ textAlign: "right", background: "#ffff00", fontWeight: 700, display: "inline-block", padding: "2px 8px", float: "right" }}>Dt. {date}</p>
      <div style={{ clear: "both" }} />
      <p><strong>To,</strong><br /><strong>The Assistant Commissioner of Customs – Exports</strong></p>
      <p><strong>Sub:</strong> Declaration to Custom<br /><strong>Ref.:</strong> DHL AWB Inv {awb} no. {order.invoiceNo}</p>
      <p>Respected Sir / Madam,</p>
      <p>We are exporting <strong>{productNames}</strong> to our customer <strong>{order.fullName}</strong> covered under <strong>{awb}</strong> DHL AWB &amp; these are used <strong>under Pharmaceutical Guidelines and License.</strong></p>
      <p>The product is non-narcotic, non-psychotropic, and not prohibited for export from India</p>
      <p>We hereby declare that these contents do not fall under SCOMET List (Special Chemicals, Organisms, Materials, Equipment and Technologies).</p>
      <p>Above mentioned details are true &amp; checked by technical expert.</p>
      <p>You are request to allow the same for export.</p>
      <br /><br />
      <p>UNNATI PHARMAX<br />( Owner : Kaushik Patel )<br />(Company Seal, Signing Authority Name &amp; Designation)</p>
    </div>
  );
}

function DHLAuthDoc({ order }: { order: Order }) {
  const date = dhlDateSlash(order);
  return (
    <div style={{ fontFamily: "Arial,sans-serif", fontSize: "11pt", padding: "20mm", lineHeight: 1.8 }}>
      <h2 style={{ textAlign: "center" }}>Authorization Letter</h2>
      <h3 style={{ textAlign: "center" }}>To whomsoever it may concern</h3>
      <p>This letter may be considered as our authorization to DHL Express (India) Pvt. Ltd. ('DHL'), including its group companies and their customs brokers and agents, to act as our agent for the purpose of arranging customs clearance at various customs airports within India for all our Shipments, arriving into or departing from, India.</p>
      <p>I/We also give our consent and authorize DHL to generate, sign, submit and file on our behalf, in physical form or digitally, the various forms like e-way bill, Bill of Entry, Shipping Bill and other forms, as and when required, under various statutes.</p>
      <p>I/We further declare that our Importer Exporter Code ("IEC") number / GSTIN and Know Your Customer ("KYC") are valid and we authorize DHL to use the same while undertaking transportation and clearance of our shipments on our behalf.</p>
      <p>This authority letter shall hold good for all proceedings and shall remain valid until revoked in writing.</p>
      <p>Thanking you,<br />Yours sincerely,</p>
      <br /><br />
      <p>Signature:<br />Designation:<br />Authorised Signatory</p>
      <p><strong>Company Name:</strong> UNNATI PHARMAX &nbsp;&nbsp;&nbsp; Company Stamp:</p>
      <p><strong>Stamp:</strong> IEC No / GSTIN / KYC document number</p>
      <p style={{ background: "#ffff00", fontWeight: 700, display: "inline-block", padding: "2px 8px" }}>Date: {date}</p>
    </div>
  );
}

function DHLNonDgrDoc({ order }: { order: Order }) {
  const awb = order.trackingNo ?? "";
  return (
    <div style={{ fontFamily: "Arial,sans-serif", fontSize: "9pt", padding: "10mm" }}>
      <h3 style={{ textAlign: "center" }}>Shipper's Certification for Non - Hazardous Cargo</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}><tbody>
        <tr><td style={{ width: "30%" }}><strong>DHL/AWB no.</strong></td><td style={{ background: "#ffff00", fontWeight: 700 }}>{awb}</td><td><strong>Airport of Dep.</strong></td><td>MUMBAI</td><td><strong>Airport of Dest.</strong></td><td>{order.country}</td></tr>
        <tr><td><strong>MAWB no.</strong></td><td></td><td><strong>INDIA</strong></td><td>MUMBAI</td><td></td><td></td></tr>
      </tbody></table>
      <p>This is to certify that the articles / substances of this shipment are properly described by name that they are not listed in the current edition of IATA / Dangerous Goods Regulations (DGR), nor do they correspond to any of the hazard classes appearing in the DGR. The goods are known not to be dangerous, i.e., not restricted.<br /><br />Furthermore the shipper confirms that the goods are in proper condition for transportation on passenger carrying aircraft (DGR, 8.1.23.) of International Air Transport Association (IATA)</p>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
        <thead><tr><th style={thS}>Marks and Proper description of goods (Trade Names not Permitted)</th><th style={{ ...thS, textAlign: "center" }}>Net Quantity</th></tr></thead>
        <tbody>{order.items.map((item, i) => <tr key={i}><td style={tdS}>{item.productName}</td><td style={{ ...tdS, textAlign: "center" }}>{item.quantity}</td></tr>)}</tbody>
      </table>
      <table style={{ width: "100%", fontSize: "8.5pt" }}><tbody>
        <tr>
          <td style={{ width: "50%", verticalAlign: "top" }}>
            <strong>Shipper:</strong><br />UNNATI PHARMAX<br />GROUND FLOOR HOUSE NO 307/04<br />GURU VANDANA APARTMENT KAKASAHEB CHOLKAR MARG<br />LAKADGANJ NAGPUR, MAHARASHTRA 440008<br /><br />
            <strong>TOTAL NUMBER OF PACKAGES: 1</strong>
          </td>
          <td style={{ width: "50%", verticalAlign: "top" }}>
            <strong>NET WEIGHT:</strong> {order.netWeight ?? "—"} KGS<br />
            <strong>GROSS WEIGHT:</strong> {order.grossWeight ?? "—"} KGS<br /><br />
            <strong>Consignee:</strong><br />{dhlConsignee(order).map((l,i) => <span key={i}>{l}<br /></span>)}<br />
            <strong>NAME:</strong> KAUSHIK &nbsp; <strong>DESIGNATION:</strong> OWNER<br />
            <strong>SIGNATURE &amp; COMPANY STAMP</strong>
          </td>
        </tr>
      </tbody></table>
    </div>
  );
}

// ── Custom square checkbox ────────────────────────────────────────────────────
function SquareCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      style={{
        width: 20, height: 20, flexShrink: 0,
        border: checked ? "2px solid var(--primary)" : "2px solid var(--text-muted)",
        borderRadius: 4,
        background: checked ? "var(--primary)" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        transition: "background 0.12s, border-color 0.12s",
        userSelect: "none",
      }}
    >
      {checked && (
        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
          <path d="M1 4L4 7.5L10 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ── Batch action bar (fixed bottom bar when orders are selected) ──────────────
function BatchActionBar({
  selectedCount,
  onGenerate,
  onViewDocs,
  onClear,
  generating,
  err,
}: {
  selectedCount: number;
  onGenerate: () => void;
  onViewDocs: () => void;
  onClear: () => void;
  generating: boolean;
  err: string;
}) {
  if (selectedCount === 0) return null;

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
      background: "var(--bg-card)",
      borderTop: "2px solid var(--primary)",
      padding: "0.75rem 1.5rem",
      display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap",
      boxShadow: "0 -4px 24px rgba(0,0,0,0.25)",
    }}>
      <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: "0.9rem" }}>
        {selectedCount} order{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
        Tracking &amp; license numbers are set per order above
      </span>
      <div style={{ flex: 1 }} />
      <button onClick={onClear} className="btn btn-secondary btn-sm">✕ Clear</button>
      <button onClick={onViewDocs} className="btn btn-secondary" style={{ fontSize: "0.9rem" }}>
        View Combined Docs
      </button>
      <button
        onClick={onGenerate}
        disabled={generating}
        className="btn btn-primary"
        style={{ fontSize: "0.9rem" }}
      >
        {generating ? "Generating…" : "Generate Combined Documents"}
      </button>
      {err && <span style={{ color: "#f87171", fontSize: "0.82rem", width: "100%" }}>{err}</span>}
    </div>
  );
}

// ── Order card ───────────────────────────────────────────────────────────────
function OrderCard({
  order,
  onInvoiceGenerated,
  onViewDocs,
}: {
  order: Order;
  onInvoiceGenerated: (id: string, invoiceNo: string, trackingNo: string, licenseNo: string) => void;
  onViewDocs: (order: Order, labelOverrides: LabelOverrides) => void;
}) {
  const isDHL = order.shipmentMode === "DHL";
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState("");
  const [stockStatus, setStockStatus] = useState<"unset" | "in_stock" | "not_in_stock">("unset");
  const [showBillPanel, setShowBillPanel] = useState(false);
  const [trackingNo, setTrackingNo]   = useState("");
  const [netWeight,  setNetWeight]    = useState("");
  const [grossWeight, setGrossWeight] = useState("");
  // CN22 label overrides — collected before invoice generation
  const [labelDesc,     setLabelDesc]     = useState("");
  const [labelValue,    setLabelValue]    = useState("");
  const [labelCurrency, setLabelCurrency] = useState(order.currency ?? "USD");
  const [labelHsn,      setLabelHsn]      = useState("");

  async function generateInvoice() {
    if (!trackingNo.trim()) { setErr("Please enter a tracking number first."); return; }

    // Hard-block if any item has zero or insufficient stock
    const outOfStock = order.items.filter(i => i.stockQty == null || i.stockQty < i.quantity);
    if (outOfStock.length > 0) {
      setErr(
        `Cannot generate invoice — ${outOfStock.length} item${outOfStock.length > 1 ? "s" : ""} not in stock: ` +
        outOfStock.map(i => `${i.productName} (need ${i.quantity}, have ${i.stockQty ?? 0})`).join("; ")
      );
      return;
    }

    setGenerating(true);
    setErr("");
    const res = await fetch("/api/packaging/invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        trackingNo: trackingNo.trim(),
        netWeight:   netWeight   ? Number(netWeight)   : null,
        grossWeight: grossWeight ? Number(grossWeight) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data?.error || "Failed");
      setGenerating(false);
      return;
    }
    onInvoiceGenerated(order.id, data.invoiceNo, trackingNo.trim(), "");
    setGenerating(false);
  }

  const hasInvoice = !!order.invoiceNo;

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: "1rem" }}>{order.fullName}</span>
            <StatusBadge s={order.status} />
            {hasInvoice && (
              <span className="badge badge-green" style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                {order.invoiceNo}
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 2 }}>
            {order.address}, {order.city}, {order.country} &nbsp;·&nbsp;
            {order.shipmentMode ?? "—"} &nbsp;·&nbsp;
            {new Date(order.createdAt).toLocaleDateString("en-IN")}
          </div>
          {order.prescriptionFileName && (
            <div style={{ fontSize: "0.78rem", color: "#60a5fa", marginTop: 4 }}>
              Prescription attached: {order.prescriptionFileName}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          {hasInvoice && (
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
              <input type="text"   value={labelDesc}     onChange={e => setLabelDesc(e.target.value)}     placeholder="Label description…"  style={{ width: 160, fontSize: "0.78rem", padding: "0.25rem 0.5rem" }} />
              <input type="number" value={labelValue}    onChange={e => setLabelValue(e.target.value)}    placeholder="Label value"         style={{ width: 90,  fontSize: "0.78rem", padding: "0.25rem 0.5rem" }} />
              <input type="text"   value={labelCurrency} onChange={e => setLabelCurrency(e.target.value)} placeholder="Currency"            style={{ width: 70,  fontSize: "0.78rem", padding: "0.25rem 0.5rem" }} />
              <input type="text"   value={labelHsn}      onChange={e => setLabelHsn(e.target.value)}      placeholder="HS tariff no…"       style={{ width: 100, fontSize: "0.78rem", padding: "0.25rem 0.5rem" }} />
            </div>
          )}
          {hasInvoice ? (
            <>
            <button
              onClick={() => onViewDocs(order, { desc: labelDesc, value: labelValue, currency: labelCurrency || order.currency, hsn: labelHsn })}
              className="btn btn-primary btn-sm"
            >
              📄 View Documents
            </button>
            <a href={`/api/packaging/orders/${order.id}/documents`} className="btn btn-secondary btn-sm">
              Download Documents
            </a>
            </>
          ) : stockStatus === "unset" ? (
            <>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginRight: 2 }}>Stock status:</span>
              <button onClick={() => setStockStatus("in_stock")} className="btn btn-primary btn-sm">
                In Stock
              </button>
              <button onClick={() => setStockStatus("not_in_stock")} className="btn btn-secondary btn-sm">
                Not In Stock
              </button>
            </>
          ) : stockStatus === "in_stock" ? (
            <>
              <input
                type="text"
                value={trackingNo}
                onChange={e => setTrackingNo(e.target.value)}
                placeholder="Tracking number…"
                style={{ width: 160, fontSize: "0.82rem", padding: "0.3rem 0.6rem" }}
              />
              <input
                type="number"
                value={netWeight}
                onChange={e => setNetWeight(e.target.value)}
                placeholder="Net Wt (kg)"
                min="0" step="0.01"
                style={{ width: 100, fontSize: "0.82rem", padding: "0.3rem 0.6rem" }}
              />
              <input
                type="number"
                value={grossWeight}
                onChange={e => setGrossWeight(e.target.value)}
                placeholder="Gross Wt (kg)"
                min="0" step="0.01"
                style={{ width: 110, fontSize: "0.82rem", padding: "0.3rem 0.6rem" }}
              />
              {/* CN22 label fields */}
              <input
                type="text"
                value={labelDesc}
                onChange={e => setLabelDesc(e.target.value)}
                placeholder="Label description…"
                style={{ width: 160, fontSize: "0.82rem", padding: "0.3rem 0.6rem" }}
              />
              <input
                type="number"
                value={labelValue}
                onChange={e => setLabelValue(e.target.value)}
                placeholder="Label value"
                min="0" step="0.01"
                style={{ width: 90, fontSize: "0.82rem", padding: "0.3rem 0.6rem" }}
              />
              <input
                type="text"
                value={labelCurrency}
                onChange={e => setLabelCurrency(e.target.value)}
                placeholder="Currency"
                style={{ width: 70, fontSize: "0.82rem", padding: "0.3rem 0.6rem" }}
              />
              <input
                type="text"
                value={labelHsn}
                onChange={e => setLabelHsn(e.target.value)}
                placeholder="HS tariff no…"
                style={{ width: 100, fontSize: "0.82rem", padding: "0.3rem 0.6rem" }}
              />
              <button
                onClick={generateInvoice}
                disabled={generating || !trackingNo.trim()}
                className="btn btn-primary btn-sm"
              >
                {generating ? "Generating…" : "Generate Invoice"}
              </button>
              <button onClick={() => setStockStatus("unset")} className="btn btn-secondary btn-sm" style={{ fontSize: "0.75rem" }}>
                ← Change
              </button>
            </>
          ) : (
            /* not_in_stock — show only a reset option; supplier suggestions are below */
            <button onClick={() => { setStockStatus("unset"); setShowBillPanel(false); }} className="btn btn-secondary btn-sm" style={{ fontSize: "0.75rem" }}>
              ← Change Status
            </button>
          )}
        </div>
      </div>

      {err && (
        <div className="alert alert-error" style={{ marginBottom: "0.5rem", padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}>
          {err}
        </div>
      )}

      {/* Not-in-stock: supplier suggestions + optional bill upload */}
      {!hasInvoice && stockStatus === "not_in_stock" && (() => {
        const outItems = order.items
          .filter((i) => i.stockQty == null || i.stockQty < i.quantity)
          .map((i) => ({
            productId: i.productId,
            productName: i.productName,
            neededQty: i.quantity,
            stockQty: i.stockQty,
          }));
        return (
          <>
            <SupplierSuggestions
              outOfStockItems={outItems}
              onProceedToUpload={() => setShowBillPanel(true)}
            />
            {showBillPanel && (
              <PurchaseBillPanel onSaved={() => { setShowBillPanel(false); setStockStatus("in_stock"); }} />
            )}
          </>
        );
      })()}

      {/* Package photos + AI weight extraction */}
      {!hasInvoice && stockStatus === "in_stock" && (
        <PackagePhotos
          onWeightExtracted={w => {
            setNetWeight(String(w));
            setGrossWeight(String(w));
          }}
        />
      )}

      {/* ── Stock summary banner ── */}
      {(() => {
        const needOrder  = order.items.filter(i => i.stockQty == null || i.stockQty === 0);
        const lowStock   = order.items.filter(i => i.stockQty != null && i.stockQty > 0 && i.stockQty < i.quantity);
        const inStock    = order.items.filter(i => i.stockQty != null && i.stockQty >= i.quantity);
        const hasIssue   = needOrder.length > 0 || lowStock.length > 0;
        if (!hasIssue) return (
          <div style={{ marginBottom: "0.5rem", padding: "6px 12px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, fontSize: "0.78rem", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#10b981", fontWeight: 700 }}>✓ All {inStock.length} items in stock</span>
          </div>
        );
        return (
          <div style={{ marginBottom: "0.5rem", padding: "6px 12px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: "0.78rem", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {needOrder.length > 0 && <span style={{ color: "#ef4444", fontWeight: 700 }}>✕ {needOrder.length} item{needOrder.length > 1 ? "s" : ""} need ordering</span>}
            {lowStock.length  > 0 && <span style={{ color: "#f97316", fontWeight: 700 }}>⚠ {lowStock.length} item{lowStock.length  > 1 ? "s" : ""} low stock</span>}
            {inStock.length   > 0 && <span style={{ color: "#10b981" }}>✓ {inStock.length} in stock</span>}
          </div>
        );
      })()}

      {/* Items preview */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ minWidth: 820, fontSize: "0.8rem" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "4px 8px" }}>Product</th>
              <th style={{ textAlign: "left", padding: "4px 8px" }}>Batch</th>
              <th style={{ textAlign: "left", padding: "4px 8px" }}>Mfg / Exp</th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>Qty Ordered</th>
              <th style={{ textAlign: "center", padding: "4px 8px" }}>Stock</th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>Purchase Rate (INR/unit)</th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>Selling Rate (INR/unit +15%)</th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>Line Total (INR)</th>
            </tr>
          </thead>

          <tbody>
            {order.items.map((item) => {
              const stockOk  = item.stockQty != null && item.stockQty >= item.quantity;
              const stockLow = item.stockQty != null && item.stockQty > 0 && item.stockQty < item.quantity;
              const stockNil = item.stockQty == null || item.stockQty === 0;
              return (
                <tr key={item.productId}>
                  <td style={{ padding: "4px 8px" }}>
                    <div style={{ fontWeight: 600 }}>{item.productName}</div>
                    {item.composition && <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{item.composition}</div>}
                  </td>

                  <td style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: "0.75rem" }}>
                    {item.batchNo ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>

                  <td style={{ padding: "4px 8px", fontSize: "0.75rem" }}>
                    {item.mfgDate ?? "—"} / {item.expDate ?? "—"}
                  </td>

                  <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>{item.quantity}</td>

                  {/* Stock badge */}
                  <td style={{ padding: "4px 8px", textAlign: "center" }}>
                    {stockOk ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 12, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                        ✓ {item.stockQty} in stock
                      </span>
                    ) : stockLow ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(249,115,22,0.12)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 12, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                        ⚠ {item.stockQty} / need {item.quantity}
                      </span>
                    ) : stockNil ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                        ✕ Order Required
                      </span>
                    ) : null}
                  </td>

                  {/* Purchase rate per unit in INR */}
                  <td style={{ padding: "4px 8px", textAlign: "right" }}>
                    {item.latestRate != null ? (
                      <span style={{ fontFamily: "monospace", color: "var(--text-primary)", fontWeight: 600 }}>
                        ₹{item.latestRate.toFixed(2)}
                      </span>
                    ) : (
                      <span style={{ color: "#f87171", fontSize: "0.75rem" }}>No purchase record</span>
                    )}
                  </td>

                  {/* INR selling rate per unit (+15%) */}
                  <td style={{ padding: "4px 8px", textAlign: "right" }}>
                    {item.inrUnit != null ? (
                      <span className="badge badge-green" style={{ fontSize: "0.7rem" }}>
                        ₹{item.inrUnit.toFixed(2)}
                      </span>
                    ) : (
                      <span style={{ color: "#f87171", fontSize: "0.75rem" }}>—</span>
                    )}
                  </td>

                  <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>
                    {item.amount != null ? `₹${item.amount.toFixed(2)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr style={{ borderTop: "2px solid var(--border)" }}>
              <td colSpan={7} style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>
                Total INR:
              </td>
              <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 700 }}>₹{order.totalInr.toFixed(2)}</td>
            </tr>

            {order.dollarAmount && (
              <tr>
                <td colSpan={7} style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>
                  Total USD:
                </td>
                <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 700 }}>${order.dollarAmount}</td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function PackagingClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDocsOrder,   setActiveDocsOrder]   = useState<Order | null>(null);
  const [activeDocsLabels,  setActiveDocsLabels]  = useState<LabelOverrides>({ desc: "", value: "", currency: "USD", hsn: "" });
  const [activeDocsOrders,  setActiveDocsOrders]  = useState<Order[] | null>(null);
  const [mainMode, setMainMode] = useState<"single" | "multi">("single");
  const [singleStatusTab, setSingleStatusTab] = useState<"ready" | "packing">("ready");
  const [multiStatusTab, setMultiStatusTab]   = useState<"ready" | "packing">("ready");

  // Batch selection state (Single Order tab only)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchErr, setBatchErr] = useState("");
  // Per-order tracking/license inputs (only used when order is selected)
  const [orderDetails, setOrderDetails] = useState<Map<string, { trackingNo: string; licenseNo: string }>>(new Map());

  function setOrderDetail(id: string, field: "trackingNo" | "licenseNo", value: string) {
    setOrderDetails((prev) => {
      const next = new Map(prev);
      const cur  = next.get(id) ?? { trackingNo: "", licenseNo: "" };
      next.set(id, { ...cur, [field]: value });
      return next;
    });
  }

  async function load() {
    setLoading(true);
    const res = await fetch("/api/packaging/orders");
    const data = await res.json();
    setOrders(data.orders ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const handleInvoiceGenerated = useCallback(
    (id: string, invoiceNo: string, trackingNo: string, licenseNo: string) => {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, invoiceNo, status: "PACKING", trackingNo, licenseNo } : o
        )
      );
    },
    []
  );

  const handleViewDocs = useCallback((order: Order, labels: LabelOverrides) => {
    setActiveDocsOrder(order);
    setActiveDocsLabels(labels);
  }, []);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function generateCombined() {
    setBatchGenerating(true);
    setBatchErr("");
    let invoiceNo: string | null = null;
    try {
      // 1. Generate one shared invoice number for all selected orders
      const invoiceRes = await fetch("/api/packaging/multi-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orders: [...selectedIds].map((id) => {
            const det = orderDetails.get(id) ?? { trackingNo: "", licenseNo: "" };
            return {
              id,
              trackingNo: det.trackingNo.trim() || null,
              licenseNo:  det.licenseNo.trim()  || null,
            };
          }),
        }),
      });

      let invoiceData: any;
      try { invoiceData = await invoiceRes.json(); } catch { invoiceData = {}; }

      if (!invoiceRes.ok) {
        setBatchErr(invoiceData?.error || `Invoice generation failed (${invoiceRes.status})`);
        return;
      }
      invoiceNo = invoiceData.invoiceNo as string;

      // 2. Download combined documents ZIP
      const docsRes = await fetch(`/api/packaging/multi-documents?invoiceNo=${encodeURIComponent(invoiceNo)}`);
      if (!docsRes.ok) {
        let errMsg = `Document download failed (${docsRes.status})`;
        try { const j = await docsRes.json(); errMsg = j?.error || errMsg; } catch { /* non-JSON error */ }
        setBatchErr(`Invoice ${invoiceNo} created — ${errMsg}. Refresh and retry download.`);
        load();
        return;
      }
      const blob = await docsRes.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${invoiceNo}-multi-documents.zip`;
      a.click();
      URL.revokeObjectURL(url);

      setSelectedIds(new Set());
      setOrderDetails(new Map());
      load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unexpected error";
      setBatchErr(invoiceNo ? `Invoice ${invoiceNo} created — ${msg}` : msg);
      load();
    } finally {
      setBatchGenerating(false);
    }
  }

  // ── Split by client type ──
  const singleOrders = orders.filter((o) => o.accountId === null);
  const multiOrders  = orders.filter((o) => o.accountId !== null);

  const singleReady   = singleOrders.filter((o) => o.status === "PAYMENT_VERIFIED");
  const singlePacking = singleOrders.filter((o) => o.status === "PACKING");
  const multiReady    = multiOrders.filter((o)  => o.status === "PAYMENT_VERIFIED");
  const multiPacking  = multiOrders.filter((o)  => o.status === "PACKING");

  // Keep selected IDs in sync when orders refresh (drop IDs that no longer exist)
  useEffect(() => {
    const validIds = new Set(singleReady.map((o) => o.id));
    setSelectedIds((prev) => {
      const filtered = new Set([...prev].filter((id) => validIds.has(id)));
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [orders]); // eslint-disable-line react-hooks/exhaustive-deps

  const Skeleton = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {[1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 14 }} />)}
    </div>
  );

  return (
    <div style={{ paddingBottom: selectedIds.size > 0 ? 90 : 0 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1>Packaging</h1>
          <p style={{ marginTop: "0.25rem" }}>
            <span style={{ color: "#6ee7b7" }}>{singleReady.length + multiReady.length} ready</span>
            {(singlePacking.length + multiPacking.length) > 0 && (
              <span style={{ color: "#fcd34d" }}> · {singlePacking.length + multiPacking.length} in packing</span>
            )}
          </p>
        </div>
        <button onClick={load} className="btn btn-secondary btn-sm">↺ Refresh</button>
      </div>

      {/* Top-level tabs: Single Order / Multi Order */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", borderBottom: "2px solid var(--border)", paddingBottom: "0.75rem" }}>
        <button
          onClick={() => { setMainMode("single"); setSelectedIds(new Set()); }}
          className={`btn btn-sm ${mainMode === "single" ? "btn-primary" : "btn-secondary"}`}
        >
          🔗 Single Order
        </button>
        <button
          onClick={() => { setMainMode("multi"); setSelectedIds(new Set()); }}
          className={`btn btn-sm ${mainMode === "multi" ? "btn-primary" : "btn-secondary"}`}
        >
          🏢 Multi Order
        </button>
      </div>

      {/* ── SINGLE ORDER tab: individual link-based clients with batch selection ── */}
      {mainMode === "single" && (
        <>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
            {[
              { key: "ready",   label: `⚡ Ready for Invoice (${singleReady.length})` },
              { key: "packing", label: `📦 In Packing (${singlePacking.length})` },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => { setSingleStatusTab(t.key as "ready" | "packing"); setSelectedIds(new Set()); }}
                className={`btn btn-sm ${singleStatusTab === t.key ? "btn-primary" : "btn-secondary"}`}
              >
                {t.label}
              </button>
            ))}
            {/* Select-all shortcut when in Ready tab */}
            {singleStatusTab === "ready" && singleReady.length > 0 && (
              <button
                onClick={() =>
                  selectedIds.size === singleReady.length
                    ? setSelectedIds(new Set())
                    : setSelectedIds(new Set(singleReady.map((o) => o.id)))
                }
                className="btn btn-secondary btn-sm"
                style={{ marginLeft: "auto" }}
              >
                {selectedIds.size === singleReady.length ? "Deselect All" : "Select All"}
              </button>
            )}
          </div>

          {loading ? <Skeleton /> : (
            <>
              {singleStatusTab === "ready" && (
                singleReady.length === 0 ? (
                  <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                    No individual orders ready for invoicing.
                  </div>
                ) : singleReady.map((o) => {
                  const checked = selectedIds.has(o.id);
                  const det = orderDetails.get(o.id) ?? { trackingNo: "", licenseNo: "" };
                  return (
                    <div key={o.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", marginBottom: "0.75rem" }}>
                      {/* Custom checkbox */}
                      <div style={{ paddingTop: 22, flexShrink: 0 }}>
                        <SquareCheckbox checked={checked} onChange={() => toggleSelect(o.id)} />
                      </div>

                      <div style={{ flex: 1 }}>
                        {/* Order card with highlight when selected */}
                        <div style={{ outline: checked ? "2px solid var(--primary)" : "none", borderRadius: 14 }}>
                          <OrderCard
                            order={o}
                            onInvoiceGenerated={handleInvoiceGenerated}
                            onViewDocs={handleViewDocs}
                          />
                        </div>

                        {/* Per-order tracking & license inputs — shown only when selected */}
                        {checked && (
                          <div style={{
                            display: "flex", gap: "0.6rem", flexWrap: "wrap",
                            padding: "0.5rem 0.75rem",
                            background: "rgba(99,102,241,0.06)",
                            border: "1px solid rgba(99,102,241,0.25)",
                            borderTop: "none",
                            borderRadius: "0 0 10px 10px",
                            marginTop: "-2px",
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                              <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Tracking No:</label>
                              <input
                                type="text"
                                value={det.trackingNo}
                                onChange={(e) => setOrderDetail(o.id, "trackingNo", e.target.value)}
                                placeholder="e.g. EM123456789IN"
                                style={{ width: 170, fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                              <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>License No:</label>
                              <input
                                type="text"
                                value={det.licenseNo}
                                onChange={(e) => setOrderDetail(o.id, "licenseNo", e.target.value)}
                                placeholder="License number"
                                style={{ width: 150, fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {singleStatusTab === "packing" && (
                singlePacking.length === 0 ? (
                  <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                    No individual orders in packing yet.
                  </div>
                ) : singlePacking.map((o) => (
                  <OrderCard key={o.id} order={o} onInvoiceGenerated={handleInvoiceGenerated} onViewDocs={handleViewDocs} />
                ))
              )}
            </>
          )}
        </>
      )}

      {/* ── MULTI ORDER tab: account/bulk clients — individual order flow, no batch ── */}
      {mainMode === "multi" && (
        <>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
            {[
              { key: "ready",   label: `⚡ Ready for Invoice (${multiReady.length})` },
              { key: "packing", label: `📦 In Packing (${multiPacking.length})` },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setMultiStatusTab(t.key as "ready" | "packing")}
                className={`btn btn-sm ${multiStatusTab === t.key ? "btn-primary" : "btn-secondary"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {loading ? <Skeleton /> : (
            <>
              {multiStatusTab === "ready" && (
                multiReady.length === 0 ? (
                  <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                    No account orders ready for invoicing.
                  </div>
                ) : multiReady.map((o) => (
                  <OrderCard key={o.id} order={o} onInvoiceGenerated={handleInvoiceGenerated} onViewDocs={handleViewDocs} />
                ))
              )}
              {multiStatusTab === "packing" && (
                multiPacking.length === 0 ? (
                  <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                    No account orders in packing yet.
                  </div>
                ) : multiPacking.map((o) => (
                  <OrderCard key={o.id} order={o} onInvoiceGenerated={handleInvoiceGenerated} onViewDocs={handleViewDocs} />
                ))
              )}
            </>
          )}
        </>
      )}

      {/* Single-order documents overlay */}
      {activeDocsOrder && <DocumentsOverlay order={activeDocsOrder} labelOverrides={activeDocsLabels} onClose={() => setActiveDocsOrder(null)} />}

      {/* Multi-order combined documents overlay */}
      {activeDocsOrders && (
        <MultiDocumentsOverlay orders={activeDocsOrders} onClose={() => setActiveDocsOrders(null)} />
      )}

      {/* Batch action bar — slides in from bottom when orders are selected */}
      <BatchActionBar
        selectedCount={selectedIds.size}
        onGenerate={generateCombined}
        onViewDocs={() => {
          const selected = singleReady.filter(o => selectedIds.has(o.id));
          if (selected.length > 0) setActiveDocsOrders(selected);
        }}
        onClear={() => { setSelectedIds(new Set()); setOrderDetails(new Map()); setBatchErr(""); }}
        generating={batchGenerating}
        err={batchErr}
      />
    </div>
  );
}
