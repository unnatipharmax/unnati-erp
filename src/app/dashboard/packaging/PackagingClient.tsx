"use client";
import React, { useState, useEffect, useCallback } from "react";
import PurchaseBillPanel from "./PurchaseBillPanel";

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

// ── DOC 2: Packing List ──────────────────────────────────────────────────────
function PackingListDoc({ order }: { order: Order }) {
  const invDate = getInvoiceDate(order);
  const dateStr = formatDateLongIN(invDate);
  const shipping = (order.shipmentMode ?? "").toUpperCase() || "—";
  const country = (order.country ?? "").toUpperCase() || "—";

  return (
    <div id="packing-list-print" style={{ fontFamily: "'Arial', sans-serif", fontSize: "9pt", color: "#111", background: "#fff" }}>
      <style>{`
        #packing-list-print .pl-border { border: 2px solid #c8960c; border-radius: 4px; overflow: hidden; }
        #packing-list-print .pl-header { background: #fef9e7; border-bottom: 2px solid #c8960c; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; }
        #packing-list-print .pl-header-logo { height: 48px; width: auto; object-fit: contain; }
        #packing-list-print .pl-header-company { text-align: right; color: #111; }
        #packing-list-print .pl-header-company .co-name { font-size: 14pt; font-weight: 800; letter-spacing: 0.04em; color: #7a5c00; }
        #packing-list-print .pl-header-company .co-addr { font-size: 7pt; color: #555; margin-top: 2px; line-height: 1.4; }
        #packing-list-print .pl-title-bar { background: #fffbeb; padding: 5px 14px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e8d080; }
        #packing-list-print .pl-title-text { font-size: 12pt; font-weight: 800; color: #7a5c00; letter-spacing: 0.1em; }
        #packing-list-print .pl-meta { display: flex; gap: 32px; font-size: 8.5pt; color: #555; font-weight: 700; }
        #packing-list-print .pl-meta .meta-val { background: #fff3b0; padding: 2px 10px; border-radius: 3px; border: 1px solid #c8960c; font-size: 9pt; color: #111; }
        #packing-list-print table.pl-table { width: 100%; border-collapse: collapse; }
        #packing-list-print table.pl-table td,
        #packing-list-print table.pl-table th { border: 1px solid #e8d080; padding: 5px 6px; vertical-align: middle; }
        #packing-list-print table.pl-table thead tr { background: #fef3c7; }
        #packing-list-print table.pl-table thead th { color: #7a5c00; font-weight: 800; text-align: center; font-size: 8pt; letter-spacing: 0.03em; border-color: #c8960c; }
        #packing-list-print table.pl-table tbody tr:nth-child(even) { background: #fffdf0; }
        #packing-list-print table.pl-table tbody td { font-weight: 600; }
        #packing-list-print .pl-footer { background: #fef9e7; padding: 6px 14px; font-size: 7.5pt; color: #444; border-top: 2px solid #c8960c; display: flex; justify-content: space-between; align-items: flex-end; }
        #packing-list-print .pl-footer .sig { text-align: right; color: #7a5c00; font-weight: 700; font-size: 8pt; }
      `}</style>

      <div className="pl-border">
        {/* ── Header ── */}
        <div className="pl-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Unnati Pharmax" className="pl-header-logo" />
          <div className="pl-header-company">
            <div className="co-name">UNNATI PHARMAX</div>
            <div className="co-addr">
              Ground Floor, House No 307/4, Guru Vandana Apartment,<br />
              Kakasaheb Cholkar Marg, Lakadganj, Nagpur – 440008, Maharashtra
            </div>
          </div>
        </div>

        {/* ── Title bar ── */}
        <div className="pl-title-bar">
          <span className="pl-title-text">PACKING LIST</span>
          <div className="pl-meta">
            <span>Invoice No: <span className="meta-val">{order.invoiceNo ?? "—"}</span></span>
            <span>Date: <span className="meta-val">{dateStr}</span></span>
          </div>
        </div>

        {/* ── Table ── */}
        <table className="pl-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>SR.NO</th>
              <th style={{ minWidth: 160 }}>CUSTOMER NAME</th>
              <th>PRODUCT NAME</th>
              <th style={{ width: 76 }}>PACKING</th>
              <th style={{ minWidth: 140 }}>MANUFACTURER</th>
              <th style={{ width: 100 }}>BATCH NO</th>
              <th style={{ width: 80 }}>EXP DATE</th>
              <th style={{ width: 46 }}>QTY</th>
              <th style={{ width: 100 }}>TRACKING NO</th>
              <th style={{ width: 70 }}>SHIPPING</th>
              <th style={{ width: 90 }}>COUNTRY</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, idx) => (
              <tr key={it.productId}>
                <td style={{ textAlign: "center" }}>{idx + 1}</td>

                {idx === 0 && (
                  <td rowSpan={order.items.length} style={{ textAlign: "center", verticalAlign: "middle" }}>
                    {order.fullName}
                  </td>
                )}

                <td style={{ textAlign: "center" }}>{it.productName}</td>
                <td style={{ textAlign: "center" }}>{(it.pack ?? "").toUpperCase()}</td>
                <td style={{ textAlign: "center" }}>{(it.manufacturer ?? "").toUpperCase()}</td>
                <td style={{ textAlign: "center" }}>{(it.batchNo ?? "").toUpperCase()}</td>
                <td style={{ textAlign: "center" }}>{it.expDate ?? ""}</td>
                <td style={{ textAlign: "center" }}>{it.quantity.toFixed(2)}</td>

                {idx === 0 && (
                  <td rowSpan={order.items.length} style={{ textAlign: "center", verticalAlign: "middle" }}>
                    {order.trackingNo ?? ""}
                  </td>
                )}

                {idx === 0 && (
                  <td rowSpan={order.items.length} style={{ textAlign: "center", verticalAlign: "middle" }}>
                    {shipping}
                  </td>
                )}

                {idx === 0 && (
                  <td rowSpan={order.items.length} style={{ textAlign: "center", verticalAlign: "middle" }}>
                    {country}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Footer ── */}
        <div className="pl-footer">
          <div>
            <b>GST No:</b> 27FNXPP3883B1ZA &nbsp;|&nbsp; <b>PAN:</b> FNXPP3883B<br />
            <b>Lic 20B:</b> MH-NG2-526036 &nbsp;|&nbsp; <b>Lic 21B:</b> MH-NAG-526037
          </div>
          <div className="sig">
            <div style={{ height: 32 }}></div>
            For UNNATI PHARMAX<br />
            Authorized Signatory
          </div>
        </div>
      </div>
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
function CN22LabelDoc({ order, companyName, companyAddress }: { order: Order; companyName?: string; companyAddress?: string }) {
  const invDate  = getInvoiceDate(order);
  // PARCEL ID format: DD.MM.YYYY
  const parcelId = [
    String(invDate.getDate()).padStart(2, "0"),
    String(invDate.getMonth() + 1).padStart(2, "0"),
    invDate.getFullYear(),
  ].join(".");

  const recipientName    = order.fullName;
  const recipientAddr    = [order.address, order.city, order.state, order.postalCode].filter(Boolean).join(", ");
  const recipientCountry = order.country;
  const totalUsd         = order.dollarAmount ?? order.amountPaid;

  // Use first item's HSN; if multiple and different, join unique ones
  const hsnSet = [...new Set(order.items.map(i => i.hsn).filter(Boolean))];
  const hsnStr = hsnSet.length ? hsnSet.join(", ") : "3004";

  // Description: join product names (simplified to "PHARMACEUTICAL PRODUCTS" if too long)
  const descRaw = order.items.map(i => i.productName).join(", ");
  const desc    = descRaw.length > 60 ? "PHARMACEUTICAL PRODUCTS" : descRaw.toUpperCase();

  return (
    <div id="cn22-print" style={{ fontFamily: "Arial, sans-serif", fontSize: "9pt", color: "#000" }}>
      <style>{`
        #cn22-print .cn-outer { display: flex; gap: 0; border: 2px solid #000; width: 100%; }
        #cn22-print .cn-left { flex: 1; border-right: 2px solid #000; }
        #cn22-print .cn-right { width: 240px; padding: 8px 10px; font-weight: 700; font-size: 9pt; line-height: 1.7; }
        #cn22-print .cn-parcel-id { background: #fff9c4; text-align: center; font-weight: 800; font-size: 13pt; padding: 6px 8px; border-bottom: 2px solid #000; letter-spacing: 0.04em; }
        #cn22-print .cn-barcode { text-align: center; font-size: 8pt; padding: 5px 8px; border-bottom: 1px solid #000; color: #555; }
        #cn22-print .cn-title { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; border-bottom: 1px solid #000; }
        #cn22-print .cn-title .ct { font-weight: 800; font-size: 10pt; }
        #cn22-print .cn-title .cn22 { font-size: 20pt; font-weight: 900; line-height: 1; }
        #cn22-print .cn-open { font-size: 7.5pt; padding: 2px 8px; border-bottom: 1px solid #000; }
        #cn22-print .cn-checkboxes { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-bottom: 1px solid #000; }
        #cn22-print .cn-cb { display: flex; align-items: center; gap: 4px; padding: 3px 8px; font-size: 8pt; border-right: 1px solid #000; border-bottom: 1px solid #000; }
        #cn22-print .cn-cb:nth-child(2n) { border-right: none; }
        #cn22-print .cn-cb:nth-child(5), #cn22-print .cn-cb:nth-child(6) { border-bottom: none; }
        #cn22-print .cb-box { width: 12px; height: 12px; border: 1.5px solid #000; display: inline-flex; align-items: center; justify-content: center; font-size: 10pt; flex-shrink: 0; }
        #cn22-print table.cn-goods { width: 100%; border-collapse: collapse; border-top: 1px solid #000; }
        #cn22-print table.cn-goods th { border: 1px solid #000; padding: 3px 4px; font-size: 7pt; text-align: center; font-weight: 700; background: #f5f5f5; vertical-align: top; }
        #cn22-print table.cn-goods td { border: 1px solid #000; padding: 4px 5px; font-size: 8.5pt; vertical-align: middle; }
        #cn22-print .cn-totals { display: flex; border-top: 1px solid #000; }
        #cn22-print .cn-totals > div { flex: 1; padding: 4px 8px; font-size: 8pt; border-right: 1px solid #000; }
        #cn22-print .cn-totals > div:last-child { border-right: none; }
        #cn22-print .cn-totals b { display: block; }
        #cn22-print .cn-declaration { padding: 5px 8px; font-size: 6.5pt; border-top: 1px solid #000; line-height: 1.4; }
        #cn22-print .cn-signature { padding: 5px 8px; font-size: 7.5pt; font-weight: 700; border-top: 1px solid #000; }
        #cn22-print .cn-right .hl { color: #b30000; font-weight: 800; }
        #cn22-print .cn-right .from-block { margin-top: 14px; font-size: 8.5pt; }
      `}</style>

      <div className="cn-outer">
        {/* ── Left panel ── */}
        <div className="cn-left">
          {/* PARCEL ID */}
          <div className="cn-parcel-id">PARCEL ID &nbsp; {parcelId}</div>

          {/* Affix barcode */}
          <div className="cn-barcode">Affix Barcode ( If Any )</div>

          {/* CUSTOMS DECLARATION title + CN22 */}
          <div className="cn-title">
            <div>
              <div className="ct">CUSTOMS</div>
              <div className="ct">DECLARATION</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "7pt", fontWeight: 700 }}>May be Opened</div>
              <div style={{ fontSize: "7pt", fontWeight: 700 }}>Officially</div>
            </div>
            <div className="cn22">CN<br />22</div>
          </div>

          {/* May be opened */}
          <div className="cn-open"></div>

          {/* Checkboxes */}
          <div className="cn-checkboxes">
            <div className="cn-cb"><span className="cb-box"></span> Gift</div>
            <div className="cn-cb"><span className="cb-box"></span> Commercial Sample</div>
            <div className="cn-cb"><span className="cb-box"></span> Documents</div>
            <div className="cn-cb"><span className="cb-box"></span> Returned Goods</div>
            <div className="cn-cb"><span className="cb-box"></span> Sale Of Goods</div>
            <div className="cn-cb"><span className="cb-box">✓</span> Other (Personal Items)</div>
          </div>

          {/* Goods table */}
          <table className="cn-goods">
            <thead>
              <tr>
                <th style={{ width: "32%" }}>Quantity and Detailed Description Of Contents (1)</th>
                <th style={{ width: "14%" }}>Net Weight (2)</th>
                <th style={{ width: "18%" }}>Value and Currency (3)</th>
                <th style={{ width: "18%" }}>H S Tariff Number (4)</th>
                <th style={{ width: "18%" }}>Country Of Origin (5)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 700 }}>{desc}</td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>
                  {order.netWeight != null ? `${order.netWeight.toFixed(3)} kg` : ""}
                </td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>{totalUsd} USD</td>
                <td style={{ textAlign: "center" }}>{hsnStr}</td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>India</td>
              </tr>
            </tbody>
          </table>

          {/* Totals */}
          <div className="cn-totals">
            <div>
              <b>Total Weight In Kg (6):</b>
              {order.grossWeight != null ? ` ${order.grossWeight.toFixed(3)} kg` : order.netWeight != null ? ` ${order.netWeight.toFixed(3)} kg` : ""}
            </div>
            <div><b>Total Value (7):</b> {totalUsd} USD</div>
          </div>

          {/* Declaration */}
          <div className="cn-declaration">
            I certify the particulars given in the customs declaration are correct.
            This form does not contain any undeclared dangerous articles, or
            articles prohibited by legislation or by postal or customs regulations.
            I have met all applicable export filing requirements under federal law and regulations.
          </div>

          {/* Signature */}
          <div className="cn-signature">DATE AND SENDER&apos;S SIGNATURE (8)</div>
        </div>

        {/* ── Right panel: Recipient + Sender ── */}
        <div className="cn-right">
          <div>
            <span className="hl">Full Name : {recipientName}</span><br />
            <span className="hl">Address : {recipientAddr}</span><br />
            <span className="hl">Country : {recipientCountry}</span>
          </div>
          <div className="from-block">
            FROM –<br />
            NAME : {companyName ?? "UNNATI PHARMAX"}<br />
            {companyAddress ?? "1/04 Guruvanada Appartment, Central Ave, Lakadganj, Nagpur 440008"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DOC 3: Form-II (template) ────────────────────────────────────────────────
function Form2Doc({ order }: { order: Order }) {
  const invDate = getInvoiceDate(order);
  const date = invDate.toLocaleDateString("en-GB");

  const exp = {
    name:      "UNNATI PHARMAX",
    address:   "Ground Floor House No 307/4, Guru Vandana Apartment, Kakasaheb Cholkar Marg, Lakadganj, Nagpur, NAGPUR, MAHARASHTRA, 440008",
    gstin:     "27FNXPP3883B1ZA",
    iec:       "FNXPP3883B",
    adCode:    "6392058-6400009",
    stateCode: "27",
    fpo:       "INBOM5",
  };

  const fob    = order.dollarAmount ?? 0;
  const exRate = order.exchangeRate ?? 84;
  const amtInr = Math.round(fob * exRate * 100) / 100;

  return (
    <div style={{ padding: "6px 0" }}>
      <style>{`
        .f2 { font-size: 7.5pt; color: #000; padding: 0 2px 2px 0; }
        .f2 table { width: 100%; border-collapse: collapse; margin-bottom: -1px; table-layout: fixed; border-right: 1px solid #000; border-bottom: 1px solid #000; }
        .f2 td, .f2 th { border: 1px solid #000; padding: 2px 3px; vertical-align: middle; color: #000; word-break: break-word; }
        .f2 .ctr { text-align: center; }
        .f2 .bold { font-weight: 700; }
        .f2 .sm { font-size: 6.5pt; }
        .f2 th { background: #fff; font-weight: 700; text-align: center; font-size: 7pt; }
      `}</style>

      <div className="f2" id="f2-print-wrapper">

        {/* ══ TABLE 1: Title + Header (10 cols) ══ */}
        <table>
          <colgroup>
            <col style={{ width: "9%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "4%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <tbody>
            <tr>
              <td colSpan={10} className="ctr bold" style={{ fontSize: "9.5pt", padding: "5px 4px", lineHeight: 1.5 }}>
                FORM-II <span style={{ fontWeight: 400, fontSize: "8pt" }}>(see regulation 4)</span><br />
                Postal Bill of Export - II<br />
                <span style={{ fontWeight: 400, fontSize: "7pt" }}>(To be submitted in duplicate)</span>
              </td>
            </tr>
            <tr>
              <th>Bill of Export<br />No and date</th>
              <th>Foreign Post<br />office code</th>
              <th>Name of<br />Exporter</th>
              <th>Address of Exporter</th>
              <th>IEC</th>
              <th>State<br />code</th>
              <th>GSTIN oras<br />Applicable</th>
              <th>AD code<br />(if Applicable)</th>
              <th colSpan={2}>Details of custom Broker<br /><span style={{ fontWeight: 400 }}>License No &nbsp;|&nbsp; Name and address</span></th>
            </tr>
            <tr>
              <td className="ctr sm">{order.invoiceNo ?? "—"}<br />{date}</td>
              <td className="ctr">{exp.fpo}</td>
              <td className="bold sm">{exp.name}</td>
              <td className="sm">{exp.address}</td>
              <td className="sm">{exp.iec}</td>
              <td className="ctr">{exp.stateCode}</td>
              <td className="sm">{exp.gstin}</td>
              <td className="sm">{exp.adCode}</td>
              <td className="bold ctr">{order.licenseNo ?? ""}</td>
              <td className="sm ctr">NA</td>
            </tr>
          </tbody>
        </table>

        {/* ══ TABLE 2: Declaration (3 cols) ══ */}
        <table>
          <colgroup>
            <col style={{ width: "3%" }} />
            <col style={{ width: "88%" }} />
            <col style={{ width: "9%" }} />
          </colgroup>
          <tbody>
            <tr>
              <td colSpan={2} className="ctr bold">Declaration</td>
              <td className="ctr bold">Yes/No as applicable</td>
            </tr>
            <tr>
              <td className="ctr">1</td>
              <td className="sm">We declare that we inted to claim rewards under Merchandise Exports from India Scheme (MEIS)(for export through Chenni / Mumbai / Delhi FPO onli).</td>
              <td className="ctr sm">Yes</td>
            </tr>
            <tr>
              <td className="ctr">2</td>
              <td className="sm">We declare that we intend to zero rate exports under Section 16 of IGST Act.</td>
              <td className="ctr sm">Yes</td>
            </tr>
            <tr>
              <td className="ctr">3</td>
              <td className="sm">We declare that the goods are exempted under CGST/SGST/UTGST/IGST Acts.</td>
              <td className="ctr sm">NO</td>
            </tr>
            <tr>
              <td colSpan={3} className="sm">
                We hereby declare that the contents of this postal bill of export are true and correct in every respect
              </td>
            </tr>
          </tbody>
        </table>

        {/* ══ TABLE 3: Signature ══ */}
        <table>
          <tbody>
            <tr>
              <td style={{ width: "40%", height: 44, verticalAlign: "bottom" }} className="sm">
                (Signature of the Exporter/ Authorised agent)
              </td>
              <td style={{ verticalAlign: "top" }} className="sm">Examination order and report</td>
            </tr>
            <tr>
              <td colSpan={2} style={{ textAlign: "right" }} className="sm">
                Let Export Order: Signature of officer of Customs along with stamp and date.
              </td>
            </tr>
          </tbody>
        </table>

        {/* ══ TABLE 4: Details of Parcel (13 cols) ══ */}
        <table>
          <colgroup>
            <col style={{ width: "13%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <tbody>
            <tr>
              <td colSpan={13} className="ctr bold" style={{ padding: "4px" }}>Details of parcel</td>
            </tr>
            <tr>
              <th colSpan={2}>Consignee details</th>
              <th colSpan={4}>Product details</th>
              <th colSpan={3}>DETAILS OF Parcel</th>
              <th colSpan={4}>Assessable value under section 14 of the Customs Act</th>
            </tr>
            <tr>
              <th>Name and Address</th>
              <th>Country of destination</th>
              <th>Description</th>
              <th>CTH HSN Code</th>
              <th>Unit<br /><span style={{ fontWeight: 400 }}>(pieces, liters, kgs, meters)</span></th>
              <th>Quinty<br />number</th>
              <th>Invoice no<br />and date</th>
              <th>Weight</th>
              <th>Postal tracking<br />nnmber</th>
              <th>FOB</th>
              <th>Currency</th>
              <th>Exchange<br />rate</th>
              <th>Amount in INR</th>
            </tr>
            {order.items.map((it, idx) => (
              <tr key={it.productId}>
                {idx === 0 && (
                  <td rowSpan={order.items.length} className="sm">
                    Full Name : {order.fullName}<br />
                    {order.address}<br />
                    {order.city}{order.state ? `, ${order.state}` : ""} {order.postalCode}<br />
                    Country : {order.country}
                  </td>
                )}
                {idx === 0 && (
                  <td rowSpan={order.items.length} className="ctr">{order.country.toUpperCase()}</td>
                )}
                <td className="bold sm">{it.productName}</td>
                <td className="ctr sm">{it.hsn ?? ""}</td>
                <td className="ctr">{(it.pack ?? "").toUpperCase()}</td>
                <td className="ctr">{it.quantity.toFixed(2)}</td>
                {idx === 0 && (
                  <td rowSpan={order.items.length} className="ctr sm">{order.invoiceNo ?? "—"}<br />{date}</td>
                )}
                {idx === 0 && (
                  <td rowSpan={order.items.length} className="ctr">GROSS</td>
                )}
                {idx === 0 && (
                  <td rowSpan={order.items.length} className="ctr bold">{order.trackingNo ?? ""}</td>
                )}
                {idx === 0 && (
                  <td rowSpan={order.items.length} className="ctr">{fob.toFixed(2)}</td>
                )}
                {idx === 0 && (
                  <td rowSpan={order.items.length} className="ctr">{order.currency}</td>
                )}
                {idx === 0 && (
                  <td rowSpan={order.items.length} className="ctr">{exRate.toFixed(2)}</td>
                )}
                {idx === 0 && (
                  <td rowSpan={order.items.length} className="ctr">{amtInr.toFixed(2)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* ══ TABLE 5: Export duty (15 cols) ══ */}
        <table>
          <colgroup>
            <col style={{ width: "7%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
          </colgroup>
          <tbody>
            <tr>
              <td colSpan={16} className="ctr bold" style={{ padding: "4px" }}>Export duty</td>
            </tr>
            <tr>
              <th rowSpan={2}>H.S<br />code</th>
              <th colSpan={2}>Invoice details</th>
              <th rowSpan={2}>value</th>
              <th colSpan={4}>Customs duties</th>
              <th colSpan={2}>IGST<br />(if applicable)</th>
              <th colSpan={2}>Compensation cess<br />(if applicable)</th>
              <th colSpan={4}>GST details</th>
            </tr>
            <tr>
              <th>Invoice no<br />and date</th>
              <th>SI No of<br />item in invoice</th>
              <th colSpan={2}>Export duty<br />rate &nbsp;|&nbsp; amount</th>
              <th colSpan={2}>Cess<br />rate &nbsp;|&nbsp; amount</th>
              <th>rate</th>
              <th>amount</th>
              <th>rate</th>
              <th>amount</th>
              <th colSpan={2}>LUT/bond<br />details<br />(if applicable)</th>
              <th>total</th>
              <th>duty</th>
              <th>cess</th>
            </tr>
            {order.items.map((it, idx) => (
              <tr key={it.productId}>
                <td className="ctr sm">{it.hsn ?? "as above"}</td>
                <td className="ctr sm">{order.invoiceNo ?? "—"}<br />{date}</td>
                <td className="ctr">{idx + 1}</td>
                <td className="ctr">0</td>
                <td className="ctr">0</td>
                <td className="ctr">0</td>
                <td className="ctr">0</td>
                <td className="ctr">0</td>
                <td className="ctr">0</td>
                <td className="ctr">0</td>
                <td className="ctr">0</td>
                <td className="ctr">0</td>
                <td className="ctr sm">AD2710230<br />37544C</td>
                <td className="ctr">0</td>
                <td className="ctr">0</td>
                <td className="ctr">0</td>
              </tr>
            ))}
          </tbody>
        </table>

      </div>
    </div>
  );
}

// ── DOC 4: EDF ────────────────────────────────────────────────────────────────
function EdfDoc({ order }: { order: Order }) {
  const invDate = getInvoiceDate(order);
  // DD-Mon-YY format e.g. "24-Jan-26"
  const dateDMY = invDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replace(/ /g, "-");
  // DD/MM/YYYY
  const dateFull = invDate.toLocaleDateString("en-GB").replace(/\//g, "/");
  // "24 January 2026"
  const dateLong = invDate.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const exporter = {
    name: "UNNATI PHARMAX",
    address: [
      "Ground Floor House No 307/4, Guru Vandana Apartment, Kakasaheb",
      "Cholkar Marg, Lakadganj, Nagpur, NAGPUR, MAHARASHTRA,",
      "440008",
    ],
    iec: "FNXPP3883B",
    adCode: "6392058-6400009",
    stateOfOrigin: "MAHARASHTRA",
  };

  const bank = {
    name: "ICICI BANK",
    address: "NEW ITWARI ROAD, GANDHI PUTLA, ITWARI",
  };

  const fobFc  = order.dollarAmount ?? 0;
  const exRate = order.exchangeRate  ?? 84;
  const fobInr = fobFc * exRate;

  // Amount in words (USD)
  function numToWordsBase(n: number): string {
    const ones = ["","ONE","TWO","THREE","FOUR","FIVE","SIX","SEVEN","EIGHT","NINE",
      "TEN","ELEVEN","TWELVE","THIRTEEN","FOURTEEN","FIFTEEN","SIXTEEN","SEVENTEEN","EIGHTEEN","NINETEEN"];
    const tens = ["","","TWENTY","THIRTY","FORTY","FIFTY","SIXTY","SEVENTY","EIGHTY","NINETY"];
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " "+ones[n%10] : "");
    if (n < 1000) return ones[Math.floor(n/100)] + " HUNDRED" + (n%100 ? " "+numToWordsBase(n%100) : "");
    if (n < 100000) return numToWordsBase(Math.floor(n/1000)) + " THOUSAND" + (n%1000 ? " "+numToWordsBase(n%1000) : "");
    if (n < 10000000) return numToWordsBase(Math.floor(n/100000)) + " LAKH" + (n%100000 ? " "+numToWordsBase(n%100000) : "");
    return numToWordsBase(Math.floor(n/10000000)) + " CRORE" + (n%10000000 ? " "+numToWordsBase(n%10000000) : "");
  }

  const fobInrRounded = Math.round(fobInr * 100) / 100;
  const fobInrInt = Math.floor(fobInrRounded);
  const fobInrPaise = Math.round((fobInrRounded - fobInrInt) * 100);
  const fobInrWords = (numToWordsBase(fobInrInt) || "ZERO") + " RUPEES"
    + (fobInrPaise ? " AND " + numToWordsBase(fobInrPaise) + " PAISE" : "") + " ONLY";

  // cell style
  const C: React.CSSProperties = { border: "1px solid #000", padding: "2px 4px", verticalAlign: "top", fontSize: "8pt", lineHeight: 1.3 };
  const B: React.CSSProperties = { fontWeight: 700 };
  const T: React.CSSProperties = { width: "100%", borderCollapse: "collapse", marginBottom: -1 };

  const shipBillLine = `${dateFull}  ${order.invoiceNo ?? "—"}`;

  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: "8pt", color: "#000" }}>

      {/* ══════════ PAGE 1 ══════════ */}
      <table style={T}>
        <colgroup>
          <col style={{ width: "8%" }} />
          <col style={{ width: "30%" }} />
          <col style={{ width: "4%" }} />
          <col style={{ width: "28%" }} />
          <col style={{ width: "30%" }} />
        </colgroup>
        <tbody>

          {/* ── Row 1: Title ── */}
          <tr>
            <td colSpan={4} style={{ ...C, ...B, fontSize: "10pt", textAlign: "center" }}>
              EXPORT DECLARATION FORM
            </td>
            <td style={{ ...C, ...B, textAlign: "right" }}>Annex I</td>
          </tr>

          {/* ── Row 2: 1 | blank | General Information ── */}
          <tr>
            <td style={C}>1</td>
            <td colSpan={3} style={C}></td>
            <td style={C}>General Information:</td>
          </tr>

          {/* ── Row 3: Customs Security No | Form No ── */}
          <tr>
            <td colSpan={2} style={C}>Customs Security No.:</td>
            <td colSpan={1} style={C}></td>
            <td colSpan={2} style={C}>Form No:</td>
          </tr>

          {/* ── Row 4: empty ── */}
          <tr><td colSpan={5} style={{ ...C, padding: "1px 4px" }}></td></tr>

          {/* ── Row 5: Nature of Cargo | Shipping Bill | Mode of Transport ── */}
          <tr>
            <td colSpan={2} style={C}>
              <div>Nature of Cargo:</div>
            </td>
            <td colSpan={1} style={C}></td>
            <td style={C}>
              <div>Shipping Bill No. &amp; Date:</div>
              <div>{shipBillLine}</div>
            </td>
            <td style={C}>
              Mode of Transport: [ ] Air [ ] Land<br />
              [ ] Sea [&#10003;] Post/Couriers [ ] others
            </td>
          </tr>

          {/* ── Row 6: Govt/Non-Govt | RBI approval ── */}
          <tr>
            <td colSpan={4} style={C}>[ ] Government [&#10003;]Non-Government</td>
            <td style={C}>RBI approval no. &amp; date, if any:</td>
          </tr>

          {/* ── Row 7: Category of Exporter ── */}
          <tr>
            <td colSpan={4} style={C}>
              Category of Exporter: [ ] Custom (DTA units) [ ] SEZ [ ] Status holder exporters
              [ ] 100% EOU [ ] Warehouse export [&#10003;] others (Specify)- Merchant Exporter
            </td>
            <td style={C}></td>
          </tr>

          {/* ── Row 8: IE CODE | AD code ── */}
          <tr>
            <td colSpan={4} style={C}>IE CODE - {exporter.iec}</td>
            <td style={C}>AD code: {bank.name === "ICICI BANK" ? exporter.adCode : ""}</td>
          </tr>

          {/* ── Row 9: Exporters Name header | AD Name header ── */}
          <tr>
            <td colSpan={4} style={C}>Exporters Name &amp; Address:</td>
            <td style={C}>AD Name &amp; Address:</td>
          </tr>

          {/* ── Row 10: Exporter name | Bank name ── */}
          <tr>
            <td colSpan={4} style={C}><span style={B}>{exporter.name}</span></td>
            <td style={C}><span style={B}>{bank.name}</span></td>
          </tr>

          {/* ── Row 11: Exporter addr line 1 | Bank addr ── */}
          <tr>
            <td colSpan={4} style={C}>{exporter.address[0]}</td>
            <td style={C}>{bank.address}</td>
          </tr>

          {/* ── Row 12: Exporter addr line 2 | blank ── */}
          <tr>
            <td colSpan={4} style={C}>{exporter.address[1]}</td>
            <td style={C}></td>
          </tr>

          {/* ── Row 13: Exporter addr line 3 | blank ── */}
          <tr>
            <td colSpan={4} style={C}>{exporter.address[2]}</td>
            <td style={C}></td>
          </tr>

          {/* ── Row 14: Consignee header | Mode of Realisation ── */}
          <tr>
            <td colSpan={4} style={C}>Consignee&apos;s Name &amp; Address:</td>
            <td style={C}>
              Mode of Realisation : [ ] L/C [ ] BG [&#10003;] Others<br />
              (advance payment, etc. including transfer/remittance to bank account maintained
            </td>
          </tr>

          {/* ── Row 15: Consignee full name (large) | BUYER ── */}
          <tr>
            <td colSpan={4} style={{ ...C, fontSize: "10pt", fontWeight: 700 }}>
              Full Name : {order.fullName}
            </td>
            <td style={C}>BUYER -</td>
          </tr>

          {/* ── Row 16: Address | Consignee name large ── */}
          <tr>
            <td colSpan={4} style={{ ...C, fontSize: "10pt", fontWeight: 700 }}>
              {order.address}
            </td>
            <td style={{ ...C, fontSize: "10pt", fontWeight: 700, textAlign: "center" }}>
              {order.fullName.toUpperCase()}
            </td>
          </tr>

          {/* ── Row 17: City/State/Postal ── */}
          <tr>
            <td colSpan={4} style={{ ...C, fontSize: "10pt", fontWeight: 700 }}>
              {[order.city, order.state].filter(Boolean).join(", ")} {order.postalCode}
            </td>
            <td style={C}></td>
          </tr>

          {/* ── Row 18: Country | Yes/No | Date ── */}
          <tr>
            <td colSpan={2} style={{ ...C, fontSize: "10pt", fontWeight: 700 }}>
              Country : {order.country}
            </td>
            <td colSpan={1} style={C}></td>
            <td style={C}>[ ] Yes [&#10003;] No</td>
            <td style={C}>{dateFull}</td>
          </tr>

          {/* ── Row 19: MEDICINES | State of Origin ── */}
          <tr>
            <td colSpan={2} style={{ ...C, textAlign: "center" }}>MEDICINES</td>
            <td colSpan={1} style={C}></td>
            <td colSpan={2} style={C}>State of Origin of Goods: {exporter.stateOfOrigin}</td>
          </tr>

          {/* ── Row 20: Total FOB in words | Custom Assessable ── */}
          <tr>
            <td colSpan={2} style={C}>Total FOB value in words (INR):</td>
            <td colSpan={1} style={C}></td>
            <td style={C}>Custom Assessable value (INR)*:</td>
            <td style={{ ...C, textAlign: "right" }}>
              {fobInrRounded.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </td>
          </tr>

          {/* ── Row 21: FOB INR value + words ── */}
          <tr>
            <td colSpan={2} style={C}>
              {fobInrRounded.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </td>
            <td colSpan={3} style={C}></td>
          </tr>
          <tr>
            <td colSpan={5} style={{ ...C, fontStyle: "italic" }}>{fobInrWords}</td>
          </tr>

          {/* ── Section 2 header ── */}
          <tr>
            <td colSpan={5} style={{ ...C, ...B }}>2. Invoice –Wise details of Export Value</td>
          </tr>
          <tr>
            <td colSpan={5} style={{ ...C, fontSize: "7pt" }}>
              ( If more than one invoice for a particular shipping bill , the block 2 will repeat as many times of invoices)
            </td>
          </tr>

          {/* ── Section 2 meta: Invoice No | Currency | Nature of Contract ── */}
          <tr>
            <td colSpan={2} style={C}>Invoice No.</td>
            <td colSpan={1} style={C}></td>
            <td style={C}>Invoice Currency:</td>
            <td style={C}>Nature of Contract:</td>
          </tr>
          <tr>
            <td colSpan={2} style={{ ...C, ...B }}>{order.invoiceNo ?? "—"}</td>
            <td colSpan={1} style={C}></td>
            <td style={{ ...C, ...B }}>{order.currency}</td>
            <td style={C}>[ ] FOB [ ] CIF [ ] C&amp;F [&#10003;] CI [ ] Others</td>
          </tr>
          <tr>
            <td colSpan={2} style={C}>Invoice date.</td>
            <td colSpan={1} style={C}></td>
            <td style={C}>Invoice Amount:</td>
            <td style={{ ...C, textAlign: "right" }}>{fobFc.toFixed(2)}</td>
          </tr>
          <tr>
            <td colSpan={2} style={{ ...C, ...B }}>{dateDMY}</td>
            <td colSpan={3} style={C}></td>
          </tr>

        </tbody>
      </table>

      {/* ── Section 2 value table (5 cols) ── */}
      <table style={T}>
        <colgroup>
          <col style={{ width: "25%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "20%" }} />
        </colgroup>
        <thead>
          <tr>
            {["Particulars","Currency","Amount in FC","Exchange Rate","Amount (INR)"].map(h => (
              <th key={h} style={{ ...C, ...B, textAlign: "center" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { label: "FOB Value",       fc: fobFc,  inr: fobInr },
            { label: "Freight",         fc: null,   inr: null   },
            { label: "Insurance",       fc: null,   inr: null   },
            { label: "Commission",      fc: null,   inr: null   },
            { label: "Discount",        fc: null,   inr: null   },
            { label: "Other Deduction", fc: null,   inr: null   },
            { label: "Packing Charges", fc: null,   inr: null   },
            { label: "",                fc: null,   inr: null   },
          ].map((row, i) => (
            <tr key={i}>
              <td style={C}>{row.label}</td>
              <td style={C}></td>
              <td style={{ ...C, textAlign: "right" }}>{row.fc != null ? row.fc.toFixed(2) : ""}</td>
              <td style={{ ...C, textAlign: "right" }}>{row.fc != null ? exRate.toFixed(2) : ""}</td>
              <td style={{ ...C, textAlign: "right" }}>
                {row.inr != null ? row.inr.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : ""}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} style={{ ...C, textAlign: "center" }}>Net Realisable value</td>
            <td style={{ ...C, textAlign: "right", ...B }}>
              {fobInrRounded.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ══════════ PAGE 2 ══════════ */}
      <div id="edf-page2" style={{ pageBreakBefore: "always", breakBefore: "page", paddingTop: 40 }}>

        <div style={{ textAlign: "center", fontWeight: 700, fontSize: "10pt", marginBottom: 10 }}>
          EXPORT DECLARATION FORM- Cont.
        </div>

        {/* Section 3 */}
        <table style={T}>
          <colgroup><col style={{ width: "60%" }} /><col style={{ width: "40%" }} /></colgroup>
          <tbody>
            <tr>
              <td colSpan={2} style={{ ...C, ...B }}>3. Applicable for Export under FPO/Couriers</td>
            </tr>
            <tr>
              <td style={{ ...C, height: 60 }}>Name of the post Office:</td>
              <td style={C}></td>
            </tr>
            <tr>
              <td style={{ ...C, height: 40 }}>Number &amp; date of Parcel receipts :-</td>
              <td style={{ ...C, textAlign: "right" }}>Stamp &amp; Signature of Authorised Dealer</td>
            </tr>
          </tbody>
        </table>

        {/* Section 4 */}
        <table style={{ ...T, marginTop: 0 }}>
          <colgroup><col /></colgroup>
          <tbody>
            <tr>
              <td style={{ ...C, ...B }}>4. Declaration by the Exporters (All types of exports)</td>
            </tr>
            <tr>
              <td style={{ ...C, lineHeight: 1.6, fontSize: "7.5pt" }}>
                I /We hereby declare that I/we @am/are the seller/consignor of the goods in respect of which this declaration is made
                and that the particulars given above are true and that the value to be received from the buyer represents the export
                value contracted and declared above. I/We undertake that I/we will deliver to the authorised dealer bank named above
                the foreign exchange representing the full value of the goods exported as above on or before ........................
                (i.e. within the period of realisation stipulated by RBI from time to time ) in the manner specified in the Regulations
                made under the Foreign Exchange Management Act, 1999.
              </td>
            </tr>
            <tr>
              <td style={{ ...C, fontSize: "7.5pt", paddingTop: 6, paddingBottom: 20 }}>
                I/We @ am/are not in the Caution List of the Reserve Bank of India.
              </td>
            </tr>
            <tr>
              <td style={C}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      <td style={{ width: "50%", verticalAlign: "bottom", paddingBottom: 4 }}>
                        {dateLong}
                      </td>
                      <td style={{ width: "50%", textAlign: "right", verticalAlign: "bottom", paddingBottom: 4 }}>
                        (Signature of Exporter)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Section 5 */}
        <table style={{ ...T, marginTop: 0 }}>
          <colgroup><col /></colgroup>
          <tbody>
            <tr>
              <td style={{ ...C, ...B }}>
                5. Space for use of the competent authority (i.e. Custom/SEZ) on behalf of Ministry concerned:
              </td>
            </tr>
            <tr>
              <td style={{ ...C, fontSize: "7.5pt", lineHeight: 1.6 }}>
                Certified, on the basis of above declaration by the Custom/SEZ unit, that the Goods described above and the export
                value declared by the exporter in this form is as per the corresponding invoice/gist of invoices submitted and
                declared by the Unit.
              </td>
            </tr>
            <tr>
              <td style={{ ...C, height: 40 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      <td style={{ width: "40%", verticalAlign: "bottom" }}>DATE-{dateFull}</td>
                      <td style={{ width: "60%", textAlign: "right", verticalAlign: "bottom" }}>
                        (Signature of Designated/Authorised officials of Custom /SEZ )
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

      </div>
    </div>
  );
}

// ── Documents overlay — all docs stacked, single print/download ───────────────
type DocSettings = { chaName: string; chaNo: string; stampB64: string; sigB64: string; companyName: string; companyAddress: string; };
const DOC_SETTINGS_DEFAULT: DocSettings = { chaName: "AARPEE CLEARING & LOGISTICS", chaNo: "11/2623", stampB64: "", sigB64: "", companyName: "UNNATI PHARMAX", companyAddress: "1/04 Guruvanada Appartment, Central Ave, Lakadganj, Nagpur 440008" };

function DocumentsOverlay({ order, onClose }: { order: Order; onClose: () => void }) {
  const isDHL        = order.shipmentMode === "DHL";
  const downloadHref = `/api/packaging/orders/${order.id}/documents`;

  const [ds, setDs] = useState<DocSettings>(DOC_SETTINGS_DEFAULT);
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

  const nonDHLDocs = [
    { label: "Export Invoice",    comp: <GSTInvoiceDoc     order={order} stampB64={ds.stampB64} sigB64={ds.sigB64} /> },
    { label: "Packing List",      comp: <PackingListDoc    order={order} /> },
    { label: "Form II",           comp: <Form2Doc          order={order} /> },
    { label: "EDF",               comp: <EdfDoc            order={order} /> },
    { label: "Covering Letter",   comp: <CoveringLetterDoc order={order} chaName={ds.chaName} chaNo={ds.chaNo} /> },
    { label: "CN22 Label",        comp: <CN22LabelDoc      order={order} companyName={ds.companyName} companyAddress={ds.companyAddress} /> },
  ];

  const dhlDocs = [
    { label: "DHL Invoice",          comp: <DHLInvoiceDoc    order={order} /> },
    { label: "DHL Packing List",     comp: <DHLPackingDoc    order={order} /> },
    { label: "ADC Sheet",            comp: <DHLAdcDoc        order={order} /> },
    { label: "Shipper's Letter",     comp: <DHLShipperDoc    order={order} /> },
    { label: "Export Declaration",   comp: <DHLExportDeclDoc order={order} /> },
    { label: "Custom Declaration",   comp: <DHLCustomDeclDoc order={order} /> },
    { label: "Authorization Letter", comp: <DHLAuthDoc       order={order} /> },
    { label: "Non-DGR Certificate",  comp: <DHLNonDgrDoc     order={order} /> },
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
  .doc-section {
    page-break-after: always;
    break-after: page;
    page-break-inside: auto;
    padding: 0;
    overflow: visible;
  }
  .doc-section:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  @page { size: A4 portrait; margin: 10mm; }
</style>
</head>
<body>${html}</body>
</html>`);
    win.document.close();

    // Wait for images to load before printing
    const imgs = win.document.images;
    if (imgs.length === 0) {
      win.focus();
      win.print();
      win.close();
    } else {
      let loaded = 0;
      const total = imgs.length;
      const tryPrint = () => {
        loaded++;
        if (loaded >= total) { win.focus(); win.print(); win.close(); }
      };
      Array.from(imgs).forEach(img => {
        if (img.complete) { tryPrint(); }
        else { img.onload = tryPrint; img.onerror = tryPrint; }
      });
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, overflowY: "auto" }}>
      <div style={{ maxWidth: 960, margin: "20px auto", background: "#fff", padding: "0 0 40px" }}>

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
            #unnati-docs-root { background: #fff !important; }
            #unnati-docs-root table { width: 100%; border-collapse: collapse; }
            #unnati-docs-root td, #unnati-docs-root th { border-color: #000 !important; }

            /* Screen-only section label divider */
            .doc-section-label {
              background: #1a1a2e !important;
              color: #fff !important;
              -webkit-text-fill-color: #fff !important;
              font-size: 10px;
              font-weight: 700;
              padding: 4px 16px;
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }
            .doc-section { padding: 12px; }
          `}</style>

          {docs.map(({ label, comp }, i) => (
            // Use Fragment so label + section are siblings at the same level.
            // This makes .doc-section:last-child match ONLY the final section,
            // so page-break-after:always fires correctly between every document.
            <React.Fragment key={i}>
              <div className="doc-section-label">
                {i + 1} / {docs.length} — {label}
              </div>
              <div className="doc-section">
                {comp}
              </div>
            </React.Fragment>
          ))}
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
  onClear,
  generating,
  err,
}: {
  selectedCount: number;
  onGenerate: () => void;
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
      <button onClick={onClear} className="btn btn-secondary btn-sm">✕ Clear selection</button>
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
  onViewDocs: (order: Order) => void;
}) {
  const isDHL = order.shipmentMode === "DHL";
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState("");
  const [stockStatus, setStockStatus] = useState<"unset" | "in_stock" | "not_in_stock">("unset");
  const [trackingNo, setTrackingNo] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [netWeight, setNetWeight] = useState("");
  const [grossWeight, setGrossWeight] = useState("");
  const [licenseOptions, setLicenseOptions] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("unnati_license_nos") || "[]"); } catch { return []; }
  });
  const [addingLicense, setAddingLicense] = useState(false);
  const [newLicenseInput, setNewLicenseInput] = useState("");

  function saveNewLicense() {
    const v = newLicenseInput.trim();
    if (!v) return;
    const updated = [...new Set([...licenseOptions, v])];
    setLicenseOptions(updated);
    localStorage.setItem("unnati_license_nos", JSON.stringify(updated));
    setLicenseNo(v);
    setAddingLicense(false);
    setNewLicenseInput("");
  }

  async function generateInvoice() {
    if (!trackingNo.trim()) { setErr("Please enter a tracking number first."); return; }
    if (isDHL && (!netWeight.trim() || !grossWeight.trim())) { setErr("Please enter Net Weight and Gross Weight for DHL shipment."); return; }
    setGenerating(true);
    setErr("");
    const res = await fetch("/api/packaging/invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        trackingNo: trackingNo.trim(),
        licenseNo: licenseNo.trim(),
        netWeight:   isDHL && netWeight   ? Number(netWeight)   : null,
        grossWeight: isDHL && grossWeight ? Number(grossWeight) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data?.error || "Failed");
      setGenerating(false);
      return;
    }
    onInvoiceGenerated(order.id, data.invoiceNo, trackingNo.trim(), licenseNo.trim());
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
          {hasInvoice ? (
            <>
            <button onClick={() => onViewDocs(order)} className="btn btn-primary btn-sm">
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
              {isDHL && (
                <>
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
                </>
              )}
              {addingLicense ? (
                <>
                  <input
                    type="text"
                    value={newLicenseInput}
                    onChange={e => setNewLicenseInput(e.target.value)}
                    placeholder="New license no…"
                    style={{ width: 130, fontSize: "0.82rem", padding: "0.3rem 0.6rem" }}
                    onKeyDown={e => e.key === "Enter" && saveNewLicense()}
                    autoFocus
                  />
                  <button onClick={saveNewLicense} className="btn btn-primary btn-sm" style={{ fontSize: "0.75rem" }}>Save</button>
                  <button onClick={() => setAddingLicense(false)} className="btn btn-secondary btn-sm" style={{ fontSize: "0.75rem" }}>✕</button>
                </>
              ) : (
                <>
                  <select
                    value={licenseNo}
                    onChange={e => setLicenseNo(e.target.value)}
                    style={{ fontSize: "0.82rem", padding: "0.3rem 0.6rem", borderRadius: 6, border: "1px solid var(--border)", minWidth: 120 }}
                  >
                    <option value="">License No…</option>
                    {licenseOptions.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <button onClick={() => setAddingLicense(true)} className="btn btn-secondary btn-sm" style={{ fontSize: "0.75rem" }}>+ Add</button>
                </>
              )}
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
            /* not_in_stock — show only a reset option; bill panel is below */
            <button onClick={() => setStockStatus("unset")} className="btn btn-secondary btn-sm" style={{ fontSize: "0.75rem" }}>
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

      {/* Inline purchase bill upload when not in stock */}
      {!hasInvoice && stockStatus === "not_in_stock" && (
        <PurchaseBillPanel onSaved={() => setStockStatus("in_stock")} />
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
  const [activeDocsOrder, setActiveDocsOrder] = useState<Order | null>(null);
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

  const handleViewDocs = useCallback((order: Order) => {
    setActiveDocsOrder(order);
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
    // 1. Generate one shared invoice number for all selected orders (per-order tracking/license)
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
    const invoiceData = await invoiceRes.json();
    if (!invoiceRes.ok) {
      setBatchErr(invoiceData?.error || "Failed to generate invoice");
      setBatchGenerating(false);
      return;
    }
    const invoiceNo: string = invoiceData.invoiceNo;

    // 2. Download combined documents ZIP automatically
    const docsRes = await fetch(`/api/packaging/multi-documents?invoiceNo=${encodeURIComponent(invoiceNo)}`);
    if (!docsRes.ok) {
      setBatchErr("Invoice created but document download failed. Invoice: " + invoiceNo);
      setBatchGenerating(false);
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
    setBatchGenerating(false);
    load();
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

      {/* Documents overlay */}
      {activeDocsOrder && <DocumentsOverlay order={activeDocsOrder} onClose={() => setActiveDocsOrder(null)} />}

      {/* Batch action bar — slides in from bottom when orders are selected */}
      <BatchActionBar
        selectedCount={selectedIds.size}
        onGenerate={generateCombined}
        onClear={() => { setSelectedIds(new Set()); setOrderDetails(new Map()); setBatchErr(""); }}
        generating={batchGenerating}
        err={batchErr}
      />
    </div>
  );
}
