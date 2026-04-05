"use client";
import { useState, useEffect, useCallback } from "react";
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

// ── DOC 1: GST Invoice (print template only) ──────────────────────────────────
function GSTInvoiceDoc({ order }: { order: Order }) {
  const invDate = getInvoiceDate(order);
  const today = formatDateLongIN(invDate);

  const mode = order.shipmentMode ?? "EMS";
  const shipLabel = `By Air through ${mode}`;

  // INR total from items
  const inrTotal = order.items.reduce((s, i) => s + (i.amount ?? 0), 0);

  function dollarToWords(n: number): string {
    const ones = ["","ONE","TWO","THREE","FOUR","FIVE","SIX","SEVEN","EIGHT","NINE","TEN","ELEVEN","TWELVE","THIRTEEN","FOURTEEN","FIFTEEN","SIXTEEN","SEVENTEEN","EIGHTEEN","NINETEEN"];
    const tens = ["","","TWENTY","THIRTY","FORTY","FIFTY","SIXTY","SEVENTY","EIGHTY","NINETY"];
    if (n === 0) return "ZERO";
    const int = Math.floor(n);
    if (int < 20) return ones[int];
    if (int < 100) return tens[Math.floor(int / 10)] + (int % 10 ? " " + ones[int % 10] : "");
    if (int < 1000) return ones[Math.floor(int / 100)] + " HUNDRED" + (int % 100 ? " " + dollarToWords(int % 100) : "");
    return dollarToWords(Math.floor(int / 1000)) + " THOUSAND" + (int % 1000 ? " " + dollarToWords(int % 1000) : "");
  }

  const usdWords = order.dollarAmount != null ? dollarToWords(order.dollarAmount) + " DOLLAR" : "";

  return (
    <div id="gst-invoice-print" style={{ fontFamily: "'Arial', sans-serif", fontSize: "8.5pt", color: "#111", background: "#fff" }}>
      <style>{`
        #gst-invoice-print { padding: 0; }
        #gst-invoice-print .inv-border { border: 2px solid #c8960c; border-radius: 4px; overflow: hidden; }
        #gst-invoice-print .inv-header { background: #fef9e7; border-bottom: 2px solid #c8960c; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; }
        #gst-invoice-print .inv-header-logo { height: 52px; width: auto; object-fit: contain; }
        #gst-invoice-print .inv-header-company { text-align: right; color: #111; }
        #gst-invoice-print .inv-header-company .co-name { font-size: 15pt; font-weight: 800; letter-spacing: 0.04em; color: #7a5c00; }
        #gst-invoice-print .inv-header-company .co-addr { font-size: 7pt; color: #555; margin-top: 2px; line-height: 1.4; }
        #gst-invoice-print .inv-title-bar { background: #fffbeb; padding: 5px 14px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e8d080; }
        #gst-invoice-print .inv-title-text { font-size: 11pt; font-weight: 800; color: #7a5c00; letter-spacing: 0.08em; }
        #gst-invoice-print .inv-title-meta { font-size: 8pt; color: #333; text-align: right; line-height: 1.6; }
        #gst-invoice-print .inv-section { display: flex; border-bottom: 1px solid #e8d080; }
        #gst-invoice-print .inv-section .col { flex: 1; padding: 7px 10px; border-right: 1px solid #e8d080; }
        #gst-invoice-print .inv-section .col:last-child { border-right: none; }
        #gst-invoice-print .inv-section .col-label { font-size: 6.5pt; color: #888; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
        #gst-invoice-print .inv-section .col-value { font-size: 8pt; color: #111; font-weight: 600; line-height: 1.5; }
        #gst-invoice-print .inv-section .col-value .co-buyer { font-weight: 800; font-size: 9pt; }
        #gst-invoice-print table.goods-table { width: 100%; border-collapse: collapse; }
        #gst-invoice-print table.goods-table td,
        #gst-invoice-print table.goods-table th { border: 1px solid #e8d080; padding: 3px 4px; vertical-align: middle; font-size: 7.5pt; }
        #gst-invoice-print table.goods-table thead tr { background: #fef3c7; }
        #gst-invoice-print table.goods-table thead th { color: #7a5c00; font-weight: 800; text-align: center; font-size: 7pt; padding: 4px 3px; border-color: #c8960c; }
        #gst-invoice-print table.goods-table tbody tr:nth-child(even) { background: #fffdf0; }
        #gst-invoice-print .totals-row td { padding: 3px 6px; font-size: 7.5pt; border: 1px solid #e8d080; }
        #gst-invoice-print .totals-row.highlight td { background: #fef3c7; color: #7a5c00; font-weight: 800; font-size: 9pt; border-color: #c8960c; }
        #gst-invoice-print .words-row { background: #fff9c4; border-top: 1px solid #e8d080; padding: 5px 10px; font-size: 8pt; font-weight: 700; color: #333; }
        #gst-invoice-print .decl-row { padding: 3px 10px; font-size: 7pt; color: #444; border-top: 1px solid #f0e8b0; }
        #gst-invoice-print .footer-bar { background: #fef9e7; padding: 7px 14px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 2px solid #c8960c; }
        #gst-invoice-print .footer-licenses { font-size: 7pt; color: #333; line-height: 1.7; }
        #gst-invoice-print .footer-sig { text-align: right; font-size: 7.5pt; color: #7a5c00; font-weight: 700; }
      `}</style>

      <div className="inv-border">
        {/* ── Header: Logo + Company ── */}
        <div className="inv-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Unnati Pharmax" className="inv-header-logo" />
          <div className="inv-header-company">
            <div className="co-name">UNNATI PHARMAX</div>
            <div className="co-addr">
              Ground Floor, House No 307/4, Guru Vandana Apartment,<br />
              Kakasaheb Cholkar Marg, Lakadganj, Nagpur – 440008, Maharashtra<br />
              GST: 27FNXPP3883B1ZA &nbsp;|&nbsp; PAN: FNXPP3883B
            </div>
          </div>
        </div>

        {/* ── Title bar ── */}
        <div className="inv-title-bar">
          <span className="inv-title-text">GST INVOICE</span>
          <div className="inv-title-meta">
            <span><b>Invoice No:</b> {order.invoiceNo ?? "—"}</span><br />
            <span><b>Date:</b> {today}</span><br />
            <span><b>Ref:</b> {order.id.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>

        {/* ── Consignee | Buyer | Shipping ── */}
        <div className="inv-section">
          <div className="col" style={{ flex: 2 }}>
            <div className="col-label">Consignee</div>
            <div className="col-value">
              <div className="co-buyer">{order.fullName}</div>
              <div>{order.address}</div>
              {order.city && <div>{order.city}{order.state ? `, ${order.state}` : ""} {order.postalCode}</div>}
              <div><b>Country:</b> {order.country}</div>
            </div>
          </div>
          <div className="col" style={{ flex: 1 }}>
            <div className="col-label">Buyer&apos;s Reference</div>
            <div className="col-value" style={{ fontWeight: 800, fontSize: "9pt" }}>{order.remitterName}</div>
          </div>
          <div className="col" style={{ flex: 1 }}>
            <div className="col-label">Shipping Details</div>
            <div className="col-value">
              <div>{shipLabel}</div>
              <div><b>Pre-carrier:</b> Mumbai</div>
              <div><b>Port of Loading:</b> Mumbai</div>
              <div><b>Origin:</b> INDIA</div>
              <div><b>Destination:</b> {order.country.toUpperCase()}</div>
            </div>
          </div>
        </div>

        {/* ── Goods Table ── */}
        <table className="goods-table">
          <thead>
            <tr>
              <th style={{ width: 22 }}>Sr.</th>
              <th style={{ width: 22 }}>Pcl</th>
              <th style={{ minWidth: 90 }}>Product</th>
              <th style={{ minWidth: 95 }}>Composition</th>
              <th style={{ minWidth: 80 }}>Manufacturer</th>
              <th style={{ width: 46 }}>HSN</th>
              <th style={{ width: 36 }}>Pack</th>
              <th style={{ width: 28 }}>GST</th>
              <th style={{ width: 56 }}>Batch No</th>
              <th style={{ width: 38 }}>Mfg</th>
              <th style={{ width: 36 }}>Exp</th>
              <th style={{ width: 30 }}>Qty</th>
              <th style={{ width: 38 }}>INR/Unit</th>
              <th style={{ width: 50 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => (
              <tr key={item.productId}>
                <td style={{ textAlign: "center" }}>{idx + 1}</td>
                <td style={{ textAlign: "center" }}>{idx + 1}</td>
                <td style={{ fontWeight: 700 }}>{item.productName}</td>
                <td>{item.composition ?? ""}</td>
                <td>{item.manufacturer ?? ""}</td>
                <td style={{ textAlign: "center" }}>{item.hsn ?? ""}</td>
                <td style={{ textAlign: "center" }}>{item.pack ?? ""}</td>
                <td style={{ textAlign: "center" }}>{item.gstPercent != null ? `${item.gstPercent}%` : ""}</td>
                <td>{item.batchNo ?? ""}</td>
                <td style={{ textAlign: "center" }}>{item.mfgDate ?? ""}</td>
                <td style={{ textAlign: "center" }}>{item.expDate ?? ""}</td>
                <td style={{ textAlign: "right" }}>{item.quantity}</td>
                <td style={{ textAlign: "right" }}>{item.inrUnit?.toFixed(2) ?? ""}</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{item.amount?.toFixed(2) ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Totals ── */}
        <table className="goods-table" style={{ marginTop: 0 }}>
          <tbody>
            <tr className="totals-row">
              <td colSpan={12} style={{ textAlign: "right", fontWeight: 700 }}>Sub Total (INR)</td>
              <td colSpan={2} style={{ textAlign: "right", fontWeight: 700 }}>{inrTotal.toFixed(2)}</td>
            </tr>
            <tr className="totals-row">
              <td colSpan={12} style={{ textAlign: "right" }}>Shipping Charges (ITPS)</td>
              <td colSpan={2} style={{ textAlign: "right" }}>Included</td>
            </tr>
            <tr className="totals-row">
              <td colSpan={12} style={{ textAlign: "right" }}>Shipping Charges (EMS)</td>
              <td colSpan={2} style={{ textAlign: "right", fontWeight: 700 }}>
                {order.shippingPrice > 0 ? order.shippingPrice.toFixed(2) : "—"}
              </td>
            </tr>
            <tr className="totals-row">
              <td colSpan={12} style={{ textAlign: "right" }}>Round Off</td>
              <td colSpan={2} style={{ textAlign: "right" }}></td>
            </tr>
            <tr className="totals-row highlight">
              <td colSpan={11} style={{ textAlign: "right" }}>TOTAL AMOUNT</td>
              <td style={{ textAlign: "center", fontSize: "8pt" }}>INR</td>
              <td colSpan={2} style={{ textAlign: "right", fontSize: "11pt" }}>
                {order.inrAmount ? Math.round(order.inrAmount).toLocaleString("en-IN") : ""}
              </td>
            </tr>
            <tr className="totals-row highlight">
              <td colSpan={11} style={{ textAlign: "right" }}>TOTAL AMOUNT</td>
              <td style={{ textAlign: "center", fontSize: "8pt" }}>USD</td>
              <td colSpan={2} style={{ textAlign: "right", fontSize: "13pt", fontWeight: 800 }}>
                {order.dollarAmount ?? ""}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Amount in words ── */}
        <div className="words-row">
          Amount in Words: {usdWords}
        </div>

        {/* ── Declarations ── */}
        <div className="decl-row">We declare that this Invoice shows the actual price of the goods described and that all particulars are true and correct.</div>
        <div className="decl-row">Export under LUT without payment of GST at 0%.</div>
        <div className="decl-row">Country of Origin: INDIA &nbsp;|&nbsp; Port of Loading: Mumbai &nbsp;|&nbsp; Final Destination: {order.country.toUpperCase()}</div>
        <div className="decl-row">Total No. of Packages: {order.items.length} &nbsp;|&nbsp; Shipment Mode: ITPS / EMS</div>

        {/* ── Footer: Licenses + Signature ── */}
        <div className="footer-bar">
          <div className="footer-licenses">
            <b>Licenses:</b> 20B: MH-NG2-526036 &nbsp;|&nbsp; 21B: MH-NAG-526037<br />
            <b>GST No:</b> 27FNXPP3883B1ZA &nbsp;|&nbsp; <b>PAN:</b> FNXPP3883B
          </div>
          <div className="footer-sig">
            <div style={{ height: 36 }}></div>
            For UNNATI PHARMAX<br />
            Authorized Signatory
          </div>
        </div>
      </div>
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
function CoveringLetterDoc({ order }: { order: Order }) {
  const invDate = getInvoiceDate(order);
  const dateStr = invDate.toLocaleDateString("en-GB"); // DD/MM/YYYY
  const invNo   = order.invoiceNo ?? "—";
  const productNames = order.items.map(i => i.productName).join(", ");

  return (
    <div id="covering-letter-print" style={{ fontFamily: "Times New Roman, serif", fontSize: "11pt", color: "#000", padding: "24px 32px", lineHeight: 1.7 }}>
      <style>{`
        #covering-letter-print .hl { background: #fff9c4; }
        @media print { #covering-letter-print { padding: 0; } }
      `}</style>

      {/* Date + Addressee */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
        <div></div>
        <div>Date: <span className="hl"><b>{dateStr}</b></span></div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <b>The Asst. Commissioner of Customs</b><br />
        Postal Appraising Section (PAS), Export Department<br />
        Foreign Post Office, VideshDakBhavan,<br />
        Ballard Piers,<br />
        Mumbai – 400 001
      </div>

      <div style={{ marginBottom: 12 }}>Dear Sir,</div>

      <div style={{ marginBottom: 12 }}>
        We request permission to export, non narcotic drugs/Medicines duly approved by Central
        Drugs Standard Control Organization (CDSCO) &amp; FDA{" "}
        <span className="hl"><b>{productNames}</b></span>{" "}
        Invoice No <span className="hl"><b>{invNo}</b></span>{" "}
        Dated <span className="hl"><b>{dateStr}</b></span>{" "}
        with reference to the Order no{" "}
        <span className="hl"><b>{invNo}</b></span>{" "}
        dated <span className="hl"><b>{dateStr}</b></span>.
      </div>

      <div style={{ marginBottom: 12 }}>
        The drugs/medicines being exported are procured in bulk from licensed manufacturers or
        their stockiest and are manufactured as per the norms notified by CDSCO and FDA.
      </div>

      <div style={{ marginBottom: 12 }}>
        The drugs/medicines are shipped in their original packing to the buyer&apos;s individual clients
        abroad as per the dispatch list forwarded along with the order.
      </div>

      <div style={{ marginBottom: 12 }}>
        The payment is received through our ICICI Bank account. 146305501090 No export
        incentive, benefits or drawback is claimed by us. The following documents are enclosed for
        your kind perusal:-
      </div>

      <ol style={{ marginBottom: 12, paddingLeft: 28 }}>
        <li>Covering Letter</li>
        <li>Invoice (4 Copies)</li>
        <li>Packing List 2 Copies</li>
        <li>IEC Copy &amp; 5 Drug License (20 B &amp; 21 B)</li>
        <li>PBE (2 copy)</li>
      </ol>

      <div style={{ marginBottom: 12 }}>
        We undertake to abide by provisions of Foreign Exchange Management Act 1999, as
        amended from time to time, including realization / repatriation of Foreign Exchange to &amp; from
        India.
      </div>

      <div style={{ marginBottom: 12 }}>
        We trust the same is in order and submit that the above declaration is true and correct and
        the goods exported are not in contravention to any laws in force.
      </div>

      <div style={{ marginBottom: 12 }}>
        We had authorized to <b>AARPEE CLEARING &amp; LOGISTICS (CHA NO: 11/2623)</b>. We
        undertake that we are responsible for the acts related to above if found violating any Law in
        force.
      </div>

      <div style={{ marginBottom: 6 }}>Thanking you,</div>
      <div style={{ marginBottom: 32 }}>Yours sincerely,</div>

      <div>
        <b>For UNNATI PHARMAX</b><br /><br /><br />
        <b>Authorized Signatory</b>
      </div>
    </div>
  );
}

// ── DOC 5: CN22 Customs Declaration Label ────────────────────────────────────
function CN22LabelDoc({ order }: { order: Order }) {
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
                <td style={{ textAlign: "center" }}></td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>{totalUsd} USD</td>
                <td style={{ textAlign: "center" }}>{hsnStr}</td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>India</td>
              </tr>
            </tbody>
          </table>

          {/* Totals */}
          <div className="cn-totals">
            <div><b>Total Weight In Kg (6):</b></div>
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
            NAME : UNNATI<br />
            SHOP NO 307/04,<br />
            GURUVANDANA<br />
            APARTMENT, NAGPUR –<br />
            440008
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

// ── Documents overlay (tabs + print) ──────────────────────────────────────────
function DocumentsOverlay({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const [doc, setDoc] = useState<"invoice" | "packing" | "form2" | "edf" | "letter" | "cn22">("invoice");
  const downloadHref = `/api/packaging/orders/${order.id}/documents`;

  const titleMap = {
    invoice: "GST Invoice",
    packing: "Packing List",
    form2:   "Form-II",
    edf:     "EDF",
    letter:  "Covering Letter",
    cn22:    "CN22 Label",
  } as const;

  return (
    <div
      id="unnati-docs-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 1000,
        overflowY: "auto",
      }}
    >
      <div style={{ maxWidth: doc === "form2" ? 1200 : 920, margin: "20px auto", background: "#fff", padding: "0 0 20px" }}>
        {/* Controls (hidden in print) */}
        <div
          data-no-print
          style={{
            background: "#1a1a2e",
            color: "#fff",
            padding: "10px 20px",
            display: "flex",
            gap: 10,
            alignItems: "center",
            position: "sticky",
            top: 0,
            zIndex: 10,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 700, marginRight: "auto" }}>
            Documents — {order.invoiceNo ?? "—"} · {titleMap[doc]}
          </span>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setDoc("invoice")} className="btn btn-sm btn-secondary">Invoice</button>
            <button onClick={() => setDoc("packing")} className="btn btn-sm btn-secondary">Packing List</button>
            <button onClick={() => setDoc("form2")}   className="btn btn-sm btn-secondary">Form-II</button>
            <button onClick={() => setDoc("edf")}     className="btn btn-sm btn-secondary">EDF</button>
            <button onClick={() => setDoc("letter")}  className="btn btn-sm btn-secondary">Covering Letter</button>
            <button onClick={() => setDoc("cn22")}    className="btn btn-sm btn-secondary">CN22 Label</button>
          </div>

          <button
            onClick={() => window.print()}
            style={{
              padding: "6px 16px",
              background: "#27ae60",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            🖨 Print
          </button>

          <a
            href={downloadHref}
            style={{
              padding: "6px 16px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Download Documents
          </a>

          <button
            onClick={onClose}
            style={{
              padding: "6px 16px",
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            ✕ Close
          </button>
          {order.prescriptionFileName && (
            <span style={{ fontSize: "0.78rem", color: "#bfdbfe" }}>
              Prescription: {order.prescriptionFileName}
            </span>
          )}
        </div>

        {/* Print + Style isolation */}
        <div
          id="unnati-docs-root"
          style={{
            padding: "12px",
            paddingRight: doc === "form2" ? "14px" : "12px",
            background: "#fff",
            color: "#000",
            overflow: "visible",
          }}
        >
          <style>{`
            /* FORCE readable text regardless of your ERP theme */
            #unnati-docs-root, #unnati-docs-root * {
              color: #000 !important;
              background: transparent;
              opacity: 1 !important;
              text-shadow: none !important;
              -webkit-text-fill-color: #000 !important;
            }
            #unnati-docs-root { background: #fff !important; }

            /* Make tables always visible */
            #unnati-docs-root table { width: 100%; border-collapse: collapse; }
            #unnati-docs-root td, #unnati-docs-root th {
              border-color: #000 !important;
            }

            /* ✅ PRINT FIX: do NOT use body > * { display:none } (causes blank pages) */
            @media print {
              body * { visibility: hidden !important; }
              #unnati-docs-overlay, #unnati-docs-overlay * { visibility: visible !important; }

              /* Remove dim background and position at top */
              #unnati-docs-overlay { background: #fff !important; position: absolute !important; inset: 0 !important; }
              #unnati-docs-root { padding: 0 !important; }

              /* Hide controls */
              [data-no-print] { display: none !important; }

              /* Landscape for Form-II, scale to one page */
              ${doc === "form2" ? `
                @page { size: A4 landscape; margin: 4mm; }
                #unnati-docs-overlay > div { max-width: none !important; width: 100% !important; }
                #f2-print-wrapper { zoom: 72%; page-break-inside: avoid; }
                .f2 table { page-break-inside: avoid; }
              ` : doc === "edf" ? `
                @page { size: A4 portrait; margin: 10mm; }
                #unnati-docs-overlay { bottom: auto !important; }
                #edf-page2 { page-break-before: always !important; break-before: page !important; }
              ` : doc === "cn22" ? `
                @page { size: A5 portrait; margin: 6mm; }
              ` : "@page { size: A4 portrait; margin: 10mm; }"}
            }
          `}</style>

          {/* Render all docs but show only active (no class collisions) */}
          <div style={{ display: doc === "invoice" ? "block" : "none" }}>
            <GSTInvoiceDoc order={order} />
          </div>

          <div style={{ display: doc === "packing" ? "block" : "none" }}>
            <PackingListDoc order={order} />
          </div>

          <div style={{ display: doc === "form2" ? "block" : "none" }}>
            <Form2Doc order={order} />
          </div>

          <div style={{ display: doc === "edf" ? "block" : "none" }}>
            <EdfDoc order={order} />
          </div>

          <div style={{ display: doc === "letter" ? "block" : "none" }}>
            <CoveringLetterDoc order={order} />
          </div>

          <div style={{ display: doc === "cn22" ? "block" : "none" }}>
            <CN22LabelDoc order={order} />
          </div>
        </div>
      </div>
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
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState("");
  const [stockStatus, setStockStatus] = useState<"unset" | "in_stock" | "not_in_stock">("unset");
  const [trackingNo, setTrackingNo] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
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
    setGenerating(true);
    setErr("");
    const res = await fetch("/api/packaging/invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, trackingNo: trackingNo.trim(), licenseNo: licenseNo.trim() }),
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
  const [tab, setTab] = useState<"ready" | "packing">("ready");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/packaging/orders");
    const data = await res.json();
    setOrders(data.orders ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const handleInvoiceGenerated = useCallback((id: string, invoiceNo: string, trackingNo: string, licenseNo: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, invoiceNo, status: "PACKING", trackingNo, licenseNo }
          : o
      )
    );
  }, []);

  const handleViewDocs = useCallback((order: Order) => {
    setActiveDocsOrder(order);
  }, []);

  const readyOrders = orders.filter((o) => o.status === "PAYMENT_VERIFIED");
  const packingOrders = orders.filter((o) => o.status === "PACKING");

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1>Packaging</h1>
          <p style={{ marginTop: "0.25rem" }}>
            <span style={{ color: "#6ee7b7" }}>{readyOrders.length} ready</span>
            {packingOrders.length > 0 && <span style={{ color: "#fcd34d" }}> · {packingOrders.length} in packing</span>}
          </p>
        </div>
        <button onClick={load} className="btn btn-secondary btn-sm">
          ↺ Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
        {[
          { key: "ready", label: `⚡ Ready for Invoice (${readyOrders.length})` },
          { key: "packing", label: `📦 In Packing (${packingOrders.length})` },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)} className={`btn btn-sm ${tab === t.key ? "btn-primary" : "btn-secondary"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 140, borderRadius: 14 }} />
          ))}
        </div>
      ) : (
        <>
          {tab === "ready" &&
            (readyOrders.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                No orders are ready for invoicing yet.
                <br />
                <span style={{ fontSize: "0.8rem" }}>Orders appear here once accounts marks them as PAYMENT_VERIFIED.</span>
              </div>
            ) : (
              readyOrders.map((o) => (
                <OrderCard key={o.id} order={o} onInvoiceGenerated={handleInvoiceGenerated} onViewDocs={handleViewDocs} />
              ))
            ))}

          {tab === "packing" &&
            (packingOrders.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                No orders in packing yet.
              </div>
            ) : (
              packingOrders.map((o) => (
                <OrderCard key={o.id} order={o} onInvoiceGenerated={handleInvoiceGenerated} onViewDocs={handleViewDocs} />
              ))
            ))}
        </>
      )}

      {/* Documents overlay */}
      {activeDocsOrder && <DocumentsOverlay order={activeDocsOrder} onClose={() => setActiveDocsOrder(null)} />}
    </div>
  );
}
