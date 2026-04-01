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
  latestRate: number | null;
  inrUnit: number | null;
  amount: number | null;
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
  const isItps = mode === "ITPS";
  const isEms  = mode === "EMS";

  // INR total from items
  const inrTotal = order.items.reduce((s, i) => s + (i.amount ?? 0), 0);

  function dollarToWords(n: number): string {
    const ones = [
      "",
      "ONE",
      "TWO",
      "THREE",
      "FOUR",
      "FIVE",
      "SIX",
      "SEVEN",
      "EIGHT",
      "NINE",
      "TEN",
      "ELEVEN",
      "TWELVE",
      "THIRTEEN",
      "FOURTEEN",
      "FIFTEEN",
      "SIXTEEN",
      "SEVENTEEN",
      "EIGHTEEN",
      "NINETEEN",
    ];
    const tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
    if (n === 0) return "ZERO";
    const int = Math.floor(n);
    if (int < 20) return ones[int];
    if (int < 100) return tens[Math.floor(int / 10)] + (int % 10 ? " " + ones[int % 10] : "");
    if (int < 1000) return ones[Math.floor(int / 100)] + " HUNDRED" + (int % 100 ? " " + dollarToWords(int % 100) : "");
    return dollarToWords(Math.floor(int / 1000)) + " THOUSAND" + (int % 1000 ? " " + dollarToWords(int % 1000) : "");
  }

  const usdWords = order.dollarAmount != null ? dollarToWords(order.dollarAmount) + " DOLLAR" : "";

  return (
    <div id="gst-invoice-print" style={{ fontFamily: "Arial, sans-serif", fontSize: "8.5pt", color: "#000" }}>
      <style>{`
        #gst-invoice-print table { width: 100%; border-collapse: collapse; }
        #gst-invoice-print td, #gst-invoice-print th {
          border: 1px solid #000; padding: 2px 3px; vertical-align: top; font-size: 8pt;
        }
        #gst-invoice-print th { background: #f2f2f2; font-weight: bold; text-align: center; font-size: 8pt; }
      `}</style>

      <table>
        <tbody>
          {/* Title */}
          <tr>
            <td colSpan={14} style={{ textAlign: "center", fontWeight: "bold", fontSize: "11pt", padding: 4, borderBottom: "1px solid #000" }}>
              GST INVOICE
            </td>
          </tr>

          {/* NAME & ADDRESS | Invoice No */}
          <tr>
            <td colSpan={7} style={{ fontWeight: "bold", padding: "2px 4px" }}>
              NAME &amp; ADDRESS
            </td>
            <td colSpan={3} style={{ padding: "2px 4px" }}>
              Invoice No.
            </td>
            <td colSpan={4} style={{ padding: "2px 4px", fontWeight: "bold" }}>
              {order.invoiceNo}
            </td>
          </tr>

          <tr>
            <td colSpan={7} rowSpan={5} style={{ verticalAlign: "top", padding: 4 }}>
              <div style={{ fontWeight: "bold", fontSize: "10.5pt", marginBottom: 2 }}>UNNATI PHARMAX</div>
              <div style={{ fontSize: "7.5pt" }}>Ground Floor House No 307/4, Guru Vandana Apartment, Kakasaheb</div>
              <div style={{ fontSize: "7.5pt" }}>Cholkar Marg, Lakadganj, Nagpur, NAGPUR, MAHARASHTRA, 440008</div>
            </td>
            <td colSpan={3} style={{ padding: "2px 4px" }}>
              Date
            </td>
            <td colSpan={4} style={{ padding: "2px 4px" }}>
              {today}
            </td>
          </tr>

          <tr>
            <td colSpan={3} style={{ padding: "2px 4px" }}>
              Email Order
            </td>
            <td colSpan={4} style={{ padding: "2px 4px" }}>
              {order.id.slice(0, 8).toUpperCase()}
            </td>
          </tr>

          <tr>
            <td colSpan={3} style={{ padding: "2px 4px" }}>
              Other Reference (s)
            </td>
            <td colSpan={4} style={{ padding: "2px 4px" }}></td>
          </tr>
          <tr>
            <td colSpan={7} style={{ padding: 2 }}></td>
          </tr>
          <tr>
            <td colSpan={7} style={{ padding: 2 }}></td>
          </tr>

          {/* Consignee | Buyer reference */}
          <tr>
            <td colSpan={7} style={{ fontWeight: "bold", padding: "2px 4px" }}>
              Consignee
            </td>
            <td colSpan={7} style={{ fontWeight: "bold", padding: "2px 4px" }}>
              Buyer's reference ( S )
            </td>
          </tr>

          <tr>
            <td colSpan={7} rowSpan={4} style={{ verticalAlign: "top", padding: 4 }}>
              <div>
                <b>Full Name :</b> {order.fullName}
              </div>
              <div>
                <b>Address :</b> {order.address}
              </div>
              {order.city && (
                <div style={{ paddingLeft: 52 }}>
                  {order.city}
                  {order.state ? `, ${order.state}` : ""} {order.postalCode}
                </div>
              )}
              <div>
                <b>Country :</b> {order.country}
              </div>
            </td>

            <td colSpan={7} rowSpan={4} style={{ verticalAlign: "middle", textAlign: "center", padding: 6, fontWeight: "bold" }}>
              {order.remitterName}
            </td>
          </tr>
          <tr></tr>
          <tr></tr>
          <tr></tr>

          {/* Place / Origin / Final */}
          <tr>
            <td colSpan={3} style={{ padding: "2px 4px" }}>
              <div style={{ fontSize: "7.5pt" }}>Place of Receipt by</div>
              <div>&nbsp;</div>
            </td>
            <td colSpan={4} style={{ padding: "2px 4px", textAlign: "center" }}>
              <div style={{ fontSize: "7.5pt" }}>Country of Origin:</div>
              <div style={{ fontWeight: "bold" }}>INDIA</div>
            </td>
            <td colSpan={3} style={{ padding: "2px 4px" }}></td>
            <td colSpan={4} style={{ padding: "2px 4px", textAlign: "right", verticalAlign: "top" }}>
              <div style={{ fontSize: "7.5pt" }}>Country of Final Des.</div>
              <div style={{ fontWeight: "bold" }}>{order.country.toUpperCase()}</div>
            </td>
          </tr>

          {/* Shipping row */}
          <tr>
            <td colSpan={2} style={{ padding: "2px 4px", fontSize: "7.5pt" }}>
              {shipLabel}
            </td>
            <td colSpan={2} style={{ padding: "2px 4px" }}>
              <div style={{ fontSize: "7.5pt" }}>Pre-carrier:</div>
              <div>Mumbai</div>
            </td>
            <td colSpan={3} style={{ padding: "2px 4px" }}>
              <div style={{ fontSize: "7.5pt" }}>Port of Loading:</div>
              <div>Mumbai</div>
            </td>
            <td colSpan={7} style={{ padding: "2px 4px" }}>
              <div style={{ fontSize: "7.5pt" }}>Terms of Delivery and payment</div>
            </td>
          </tr>

          {/* Port of discharge / Final Destination */}
          <tr>
            <td colSpan={4} style={{ padding: "2px 4px" }}>
              <span style={{ fontSize: "7.5pt" }}>Port of Discharge: &mdash;&mdash;&mdash;</span>
            </td>
            <td colSpan={3} style={{ padding: "2px 4px" }}>
              <span style={{ fontSize: "7.5pt" }}>Final Destination:</span>
              <span style={{ fontWeight: "bold" }}> {order.country.toUpperCase()}</span>
            </td>
            <td colSpan={7} style={{ padding: "2px 4px" }}>
              <span style={{ fontSize: "7.5pt" }}>{order.country.toUpperCase()}</span>
            </td>
          </tr>

          {/* Goods table */}
          <tr>
            <td colSpan={14} style={{ textAlign: "center", fontWeight: "bold", background: "#f5f5f5", padding: 3 }}>
              Description of Goods
            </td>
          </tr>

          <tr style={{ background: "#f5f5f5" }}>
            <th style={{ width: 24 }}>Sr.No</th>
            <th style={{ width: 24, fontSize: "7pt" }}>No Par cel</th>
            <th style={{ width: 95 }}>Products</th>
            <th style={{ width: 100 }}>Composition</th>
            <th style={{ width: 85 }}>Mfg Name</th>
            <th style={{ width: 50 }}>HSN Code</th>
            <th style={{ width: 34 }}>Packing</th>
            <th style={{ width: 22 }}>GST</th>
            <th style={{ width: 56 }}>Batch No</th>
            <th style={{ width: 36 }}>Mfg date</th>
            <th style={{ width: 32 }}>Exp Date</th>
            <th style={{ width: 28 }}>Unit</th>
            <th style={{ width: 32 }}>INR Unit</th>
            <th style={{ width: 50 }}>Amount</th>
          </tr>

          {order.items.map((item, idx) => (
            <tr key={item.productId}>
              <td style={{ textAlign: "center" }}>{idx + 1}</td>
              <td style={{ textAlign: "center" }}>{idx + 1}</td>
              <td style={{ fontWeight: 600 }}>{item.productName}</td>
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
              <td style={{ textAlign: "right" }}>{item.amount?.toFixed(2) ?? ""}</td>
            </tr>
          ))}

          {/* Totals block — mirrors PDF layout exactly */}
          {/* Row 1: No Of Shipment | Licenses (rowspan 8) | Sub Total | inrTotal */}
          <tr>
            <td colSpan={2} rowSpan={2} style={{ verticalAlign: "top", padding: "2px 4px", fontSize: "7.5pt" }}>
              <b>No Of</b><br /><b>Shipment</b>
            </td>

            <td colSpan={8} rowSpan={8} style={{ verticalAlign: "bottom", padding: 4 }}>
              <div style={{ marginBottom: 2 }}><b>Licenses</b></div>
              <div style={{ fontSize: "7.5pt" }}>20B &nbsp; MH-NG2-526036</div>
              <div style={{ fontSize: "7.5pt" }}>21B &nbsp; MH-NAG-526037</div>
              <div style={{ fontSize: "7.5pt" }}><b>GST No</b> &nbsp; 27FNXPP3883B1ZA</div>
              <div style={{ fontSize: "7.5pt" }}><b>PAN</b> &nbsp; FNXPP3883B</div>
            </td>

            <td colSpan={2} style={{ padding: "2px 4px", fontSize: "7.5pt" }}>Sub Total</td>
            <td colSpan={2} style={{ textAlign: "right", fontWeight: "bold" }}>
              {inrTotal.toFixed(2)}
            </td>
          </tr>

          {/* Row 2: Shipping Charges (ITPS) — always shown, blank amount (ITPS is included) */}
          <tr>
            <td colSpan={2} style={{ padding: "2px 4px", fontSize: "7.5pt" }}>
              Shipping Charges (ITPS)
            </td>
            <td colSpan={2} style={{ textAlign: "right" }}></td>
          </tr>

          {/* Row 3: Included */}
          <tr>
            <td colSpan={2} style={{ padding: "2px 4px", border: "none" }}></td>
            <td colSpan={2} style={{ padding: "2px 4px", fontSize: "7.5pt" }}>Included</td>
            <td colSpan={2}></td>
          </tr>

          {/* Row 4: Shipping Charges (EMS) — dynamic amount */}
          <tr>
            <td colSpan={2} style={{ padding: "2px 4px", border: "none" }}></td>
            <td colSpan={2} style={{ padding: "2px 4px", fontSize: "7.5pt" }}>
              Shipping Charges (EMS)
            </td>
            <td colSpan={2} style={{ textAlign: "right", fontWeight: "bold" }}>
              {order.shippingPrice > 0 ? order.shippingPrice.toFixed(2) : ""}
            </td>
          </tr>

          {/* Row 5: Rs */}
          <tr>
            <td colSpan={2} style={{ padding: "2px 4px", border: "none" }}></td>
            <td colSpan={2} style={{ padding: "2px 4px", fontSize: "7.5pt" }}>Rs</td>
            <td colSpan={2}></td>
          </tr>

          {/* Row 6: Total */}
          <tr>
            <td colSpan={2} style={{ padding: "2px 4px", border: "none" }}></td>
            <td colSpan={2} style={{ padding: "2px 4px", fontSize: "7.5pt" }}>Total</td>
            <td colSpan={2}></td>
          </tr>

          {/* Row 7: Round Off */}
          <tr>
            <td colSpan={2} style={{ padding: "2px 4px", border: "none" }}></td>
            <td colSpan={2} style={{ padding: "2px 4px", fontSize: "7.5pt" }}>Round Off</td>
            <td colSpan={2}></td>
          </tr>

          {/* Row 8: Total Amount INR */}
          <tr>
            <td colSpan={2} style={{ padding: "2px 4px", border: "none" }}></td>
            <td colSpan={2} style={{ padding: "2px 4px", fontWeight: "bold", fontSize: "7.5pt" }}>Total Amount</td>
            <td style={{ padding: "2px 4px", fontWeight: "bold", textAlign: "right", fontSize: "7.5pt" }}>INR</td>
            <td style={{ textAlign: "right", fontWeight: "bold", fontSize: "11pt", padding: "2px 4px" }}>
              {order.inrAmount ? Math.round(order.inrAmount).toLocaleString("en-IN") : ""}
            </td>
          </tr>

          {/* USD row */}
          <tr>
            <td colSpan={11} style={{ border: "none" }}></td>
            <td colSpan={2} style={{ padding: "2px 4px", fontWeight: "bold", textAlign: "right", fontSize: "7.5pt" }}>USD</td>
            <td style={{ textAlign: "right", fontWeight: "bold", fontSize: "14pt", padding: "2px 4px" }}>
              {order.dollarAmount ?? ""}
            </td>
          </tr>

          {/* Amount in words */}
          <tr>
            <td colSpan={14} style={{ padding: "3px 5px", fontSize: "8pt", background: "#ffff99" }}>
              Amount ( In Words ) - {usdWords}
            </td>
          </tr>

          {/* Declarations */}
          <tr>
            <td colSpan={14} style={{ padding: "2px 5px", fontSize: "7.5pt" }}>
              Described and that all particulars are true and correct.
            </td>
          </tr>
          <tr>
            <td colSpan={14} style={{ padding: "2px 5px", fontSize: "7.5pt" }}>
              Export under lut without payment of gst at 0%
            </td>
          </tr>
          <tr>
            <td colSpan={14} style={{ padding: "2px 5px", fontSize: "7.5pt" }}>
              We declare that this Invoice shows actual price of goods
            </td>
          </tr>
          <tr>
            <td colSpan={14} style={{ padding: "2px 5px", fontSize: "7.5pt" }}>
              described and that all particulars are true and correct.
            </td>
          </tr>

          {/* Total packages — count = number of distinct product lines */}
          <tr>
            <td colSpan={4} style={{ padding: "3px 5px", fontWeight: "bold", fontSize: "8pt" }}>
              Total Number and kind of packages
            </td>
            <td colSpan={10} style={{ padding: "3px 5px", fontSize: "8pt", fontWeight: "bold" }}>
              ITPS &nbsp; EMS &nbsp; {order.items.length}
            </td>
          </tr>

          {/* Signature */}
          <tr>
            <td colSpan={14} style={{ height: 50, padding: "4px 8px", verticalAlign: "bottom", textAlign: "right", fontSize: "8.5pt" }}>
              Authorized Signatory
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
    <div style={{ padding: "10px 0" }}>
      <style>{`
        .pl table { width: 100%; border-collapse: collapse; font-size: 10pt; }
        .pl td, .pl th { border: 1px solid #000; padding: 6px 6px; vertical-align: middle; }
        .pl .title { font-weight: 700; text-align: center; font-size: 13pt; }
        .pl .yellow { background: #ffeb3b; font-weight: 700; text-align: center; }
        .pl th { font-weight: 700; text-align: center; background: #fff; }
      `}</style>

      <div className="pl">
        <table>
          <tbody>
            <tr>
              <td colSpan={11} className="title">
                Packing List
              </td>
            </tr>

            <tr>
              <td colSpan={2} style={{ fontWeight: 700, textAlign: "center" }}>
                Invoice No.
              </td>
              <td colSpan={9} className="yellow">
                {order.invoiceNo ?? "—"}
              </td>
            </tr>

            <tr>
              <td colSpan={2} style={{ fontWeight: 700, textAlign: "center" }}>
                Date :-
              </td>
              <td colSpan={9} className="yellow">
                {dateStr}
              </td>
            </tr>

            <tr>
              <th style={{ width: 60 }}>SR.NO</th>
              <th style={{ width: 220 }}>CUSTOMER NAME</th>
              <th>Product Name</th>
              <th style={{ width: 80 }}>packing</th>
              <th style={{ width: 180 }}>
                <i>Manufacturer</i>
              </th>
              <th style={{ width: 120 }}>Batch No</th>
              <th style={{ width: 90 }}>Exp date</th>
              <th style={{ width: 60 }}>QTY</th>
              <th style={{ width: 110 }}><u>Tracking No</u></th>
              <th style={{ width: 90 }}>Shipping</th>
              <th style={{ width: 110 }}>country</th>
            </tr>

            {order.items.map((it, idx) => (
              <tr key={it.productId}>
                <td style={{ textAlign: "center", fontWeight: 700 }}>{idx + 1}</td>

                {idx === 0 && (
                  <td rowSpan={order.items.length} style={{ textAlign: "center", fontWeight: 700 }}>
                    Full Name : {order.fullName}
                  </td>
                )}

                <td style={{ textAlign: "center", fontWeight: 700 }}>{it.productName}</td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>{(it.pack ?? "").toUpperCase()}</td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>{(it.manufacturer ?? "").toUpperCase()}</td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>{(it.batchNo ?? "").toUpperCase()}</td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>{it.expDate ?? ""}</td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>{it.quantity.toFixed(2)}</td>

                {idx === 0 && (
                  <td rowSpan={order.items.length} style={{ textAlign: "center", fontWeight: 700 }}>
                    {order.trackingNo ?? ""}
                  </td>
                )}

                {idx === 0 && (
                  <td rowSpan={order.items.length} style={{ textAlign: "center", fontWeight: 700 }}>
                    {shipping}
                  </td>
                )}

                {idx === 0 && (
                  <td rowSpan={order.items.length} style={{ textAlign: "center", fontWeight: 700 }}>
                    {country}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
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
          <col style={{ width: "8%" }} />  {/* col A */}
          <col style={{ width: "30%" }} /> {/* col B */}
          <col style={{ width: "4%" }} />  {/* col C - narrow spacer */}
          <col style={{ width: "28%" }} /> {/* col D */}
          <col style={{ width: "30%" }} /> {/* col E */}
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
  const [doc, setDoc] = useState<"invoice" | "packing" | "form2" | "edf">("invoice");
  const downloadHref = `/api/packaging/orders/${order.id}/documents`;

  const titleMap = {
    invoice: "GST Invoice",
    packing: "Packing List",
    form2: "Form-II",
    edf: "EDF",
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
            <button onClick={() => setDoc("invoice")} className="btn btn-sm btn-secondary">
              Invoice
            </button>
            <button onClick={() => setDoc("packing")} className="btn btn-sm btn-secondary">
              Packing List
            </button>
            <button onClick={() => setDoc("form2")} className="btn btn-sm btn-secondary">
              Form-II
            </button>
            <button onClick={() => setDoc("edf")} className="btn btn-sm btn-secondary">
              EDF
            </button>
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

      {/* Items preview */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ minWidth: 700, fontSize: "0.8rem" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "4px 8px" }}>Product</th>
              <th style={{ textAlign: "left", padding: "4px 8px" }}>Batch</th>
              <th style={{ textAlign: "left", padding: "4px 8px" }}>Mfg / Exp</th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>Qty</th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>Purchase Rate</th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>INR Unit (+15%)</th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>Amount</th>
            </tr>
          </thead>

          <tbody>
            {order.items.map((item) => (
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

                <td style={{ padding: "4px 8px", textAlign: "right" }}>{item.quantity}</td>

                <td style={{ padding: "4px 8px", textAlign: "right", color: "var(--text-secondary)" }}>
                  {item.latestRate != null ? `₹${item.latestRate.toFixed(2)}` : <span style={{ color: "#f87171" }}>No purchase</span>}
                </td>

                <td style={{ padding: "4px 8px", textAlign: "right" }}>
                  {item.inrUnit != null ? (
                    <span className="badge badge-green" style={{ fontSize: "0.7rem" }}>
                      ₹{item.inrUnit.toFixed(2)}
                    </span>
                  ) : (
                    <span style={{ color: "#f87171", fontSize: "0.75rem" }}>Missing</span>
                  )}
                </td>

                <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>{item.amount != null ? `₹${item.amount.toFixed(2)}` : "—"}</td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr style={{ borderTop: "2px solid var(--border)" }}>
              <td colSpan={6} style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>
                Total INR:
              </td>
              <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 700 }}>₹{order.totalInr.toFixed(2)}</td>
            </tr>

            {order.dollarAmount && (
              <tr>
                <td colSpan={6} style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>
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
