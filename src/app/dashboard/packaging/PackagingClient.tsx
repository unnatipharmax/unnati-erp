"use client";
import { useState, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
type Item = {
  productId: string; productName: string; composition: string | null;
  manufacturer: string | null; hsn: string | null; pack: string | null;
  gstPercent: number | null; batchNo: string | null;
  mfgDate: string | null; expDate: string | null;
  quantity: number; sellingPrice: number;
  latestRate: number | null; inrUnit: number | null; amount: number | null;
};

type Order = {
  id: string; invoiceNo: string | null; invoiceGeneratedAt: string | null;
  status: string; fullName: string; address: string; city: string;
  state: string; postalCode: string; country: string;
  remitterName: string; amountPaid: number; currency: string;
  exchangeRate: number; dollarAmount: number | null; inrAmount: number | null;
  createdAt: string; shipmentMode: string | null; shippingPrice: number;
  items: Item[]; totalInr: number; totalUsd: number | null;
};

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    PAYMENT_VERIFIED: "badge-green",
    PACKING: "badge-amber",
  };
  return <span className={`badge ${map[s] ?? "badge-gray"}`}>{s.replace("_", " ")}</span>;
}

// ── GST Invoice print view ───────────────────────────────────────────────────
function GSTInvoice({ order, onClose }: { order: Order; onClose: () => void }) {
  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const shipLabel = order.shipmentMode ?? "By Air through EMS";
  const isItps    = order.shipmentMode === "ITPS";
  const isEms     = order.shipmentMode === "EMS";

  // INR total from items
  const inrTotal = order.items.reduce((s, i) => s + (i.amount ?? 0), 0);

  function dollarToWords(n: number): string {
    const ones = ["","ONE","TWO","THREE","FOUR","FIVE","SIX","SEVEN","EIGHT","NINE",
      "TEN","ELEVEN","TWELVE","THIRTEEN","FOURTEEN","FIFTEEN","SIXTEEN",
      "SEVENTEEN","EIGHTEEN","NINETEEN"];
    const tens = ["","","TWENTY","THIRTY","FORTY","FIFTY","SIXTY","SEVENTY","EIGHTY","NINETY"];
    if (n === 0) return "ZERO";
    const int = Math.floor(n);
    if (int < 20) return ones[int];
    if (int < 100) return tens[Math.floor(int/10)] + (int%10 ? " " + ones[int%10] : "");
    if (int < 1000) return ones[Math.floor(int/100)] + " HUNDRED" + (int%100 ? " " + dollarToWords(int%100) : "");
    return dollarToWords(Math.floor(int/1000)) + " THOUSAND" + (int%1000 ? " " + dollarToWords(int%1000) : "");
  }

  const usdWords = order.dollarAmount ? dollarToWords(order.dollarAmount) + " DOLLAR" : "";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, overflowY: "auto" }}>
      <div style={{ maxWidth: 820, margin: "20px auto", background: "#fff", padding: "0 0 20px" }}>
        {/* Controls */}
        <div style={{ background: "#1a1a2e", color: "#fff", padding: "10px 20px", display: "flex", gap: 12, alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
          <span style={{ fontWeight: 700, marginRight: "auto" }}>GST Invoice — {order.invoiceNo}</span>
          <button onClick={() => window.print()} style={{ padding: "6px 16px", background: "#27ae60", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>🖨 Print</button>
          <button onClick={onClose} style={{ padding: "6px 16px", background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ Close</button>
        </div>

        {/* ── INVOICE ── */}
        <div id="gst-invoice-print" style={{ fontFamily: "Arial, sans-serif", fontSize: "8.5pt", color: "#000", padding: "0 12px" }}>
          <style>{`
            @media print {
              body > * { display: none !important; }
              #gst-invoice-print { display: block !important; }
              #gst-invoice-print { padding: 0; }
            }
            #gst-invoice-print table { width: 100%; border-collapse: collapse; }
            #gst-invoice-print td, #gst-invoice-print th {
              border: 1px solid #000; padding: 2px 3px; vertical-align: top; font-size: 8pt;
            }
            #gst-invoice-print th { background: #f2f2f2; font-weight: bold; text-align: center; font-size: 8pt; }
          `}</style>

          <table>
            {/* Title */}
            <tr><td colSpan={14} style={{ textAlign: "center", fontWeight: "bold", fontSize: "11pt", padding: 4, borderBottom: "1px solid #000" }}>GST INVOICE</td></tr>

            {/* NAME & ADDRESS | Invoice No */}
            <tr>
              <td colSpan={7} style={{ fontWeight: "bold", padding: "2px 4px" }}>NAME &amp; ADDRESS</td>
              <td colSpan={3} style={{ padding: "2px 4px" }}>Invoice No.</td>
              <td colSpan={4} style={{ padding: "2px 4px", fontWeight: "bold" }}>{order.invoiceNo}</td>
            </tr>
            <tr>
              <td colSpan={7} rowSpan={5} style={{ verticalAlign: "top", padding: 4 }}>
                <div style={{ fontWeight: "bold", fontSize: "10.5pt", marginBottom: 2 }}>UNNATI PHARMAX</div>
                <div style={{ fontSize: "7.5pt" }}>Ground Floor House No 307/4, Guru Vandana Apartment, Kakasaheb</div>
                <div style={{ fontSize: "7.5pt" }}>Cholkar Marg, Lakadganj, Nagpur, NAGPUR, MAHARASHTRA, 440008</div>
              </td>
              <td colSpan={3} style={{ padding: "2px 4px" }}>Date</td>
              <td colSpan={4} style={{ padding: "2px 4px" }}>{today}</td>
            </tr>
            <tr>
              <td colSpan={3} style={{ padding: "2px 4px" }}>Email Order</td>
              <td colSpan={4} style={{ padding: "2px 4px" }}>{order.id.slice(0,8).toUpperCase()}</td>
            </tr>
            <tr>
              <td colSpan={3} style={{ padding: "2px 4px" }}>Other Reference (s)</td>
              <td colSpan={4} style={{ padding: "2px 4px" }}></td>
            </tr>
            <tr><td colSpan={7} style={{ padding: 2 }}></td></tr>
            <tr><td colSpan={7} style={{ padding: 2 }}></td></tr>

            {/* Consignee | Buyer reference */}
            <tr>
              <td colSpan={7} style={{ fontWeight: "bold", padding: "2px 4px" }}>Consignee</td>
              <td colSpan={7} style={{ fontWeight: "bold", padding: "2px 4px" }}>Buyer's reference ( S )</td>
            </tr>
            <tr>
              <td colSpan={7} rowSpan={4} style={{ verticalAlign: "top", padding: 4 }}>
                <div><b>Full Name :</b> {order.fullName}</div>
                <div><b>Address :</b> {order.address}</div>
                {order.city && <div style={{ paddingLeft: 52 }}>{order.city}{order.state ? `, ${order.state}` : ""} {order.postalCode}</div>}
                <div><b>Country :</b> {order.country}</div>
              </td>
              <td colSpan={7} rowSpan={4} style={{ verticalAlign: "middle", textAlign: "center", padding: 6, fontWeight: "bold" }}>
                {order.remitterName}
              </td>
            </tr>
            <tr></tr><tr></tr><tr></tr>

            {/* Place of receipt / Country of Origin / Country of Final Des */}
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

            {/* By Air / Pre-carrier / Port of Loading / Terms */}
            <tr>
              <td colSpan={2} style={{ padding: "2px 4px", fontSize: "7.5pt" }}>{shipLabel}</td>
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

            {/* Port of Discharge / Final Destination */}
            <tr>
              <td colSpan={4} style={{ padding: "2px 4px" }}>
                <span style={{ fontSize: "7.5pt" }}>Port of Discharge: -----</span>
              </td>
              <td colSpan={3} style={{ padding: "2px 4px" }}>
                <span style={{ fontSize: "7.5pt" }}>Final Destination:</span>
                <span style={{ fontWeight: "bold" }}> {order.country.toUpperCase()}</span>
              </td>
              <td colSpan={7}></td>
            </tr>

            {/* Product table header */}
            <tr><td colSpan={14} style={{ textAlign: "center", fontWeight: "bold", background: "#f5f5f5", padding: 3 }}>Description of Goods</td></tr>
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

            {/* Product rows */}
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

            {/* No of Shipment + totals */}
            <tr>
              <td colSpan={2} rowSpan={2} style={{ verticalAlign: "top", padding: "2px 4px", fontSize: "7.5pt" }}>
                <b>No Of</b><br/><b>Shipment</b>
              </td>
              <td colSpan={8} rowSpan={8} style={{ verticalAlign: "bottom", padding: 4 }}>
                <div style={{ marginBottom: 2 }}><b>Licenses</b></div>
                <div style={{ fontSize: "7.5pt" }}>20B &nbsp; MH-NG2-526036</div>
                <div style={{ fontSize: "7.5pt" }}>21B &nbsp; MH-NAG-526037</div>
                <div style={{ fontSize: "7.5pt" }}><b>GST No</b> &nbsp; 27FNXPP3883B1ZA</div>
                <div style={{ fontSize: "7.5pt" }}><b>PAN</b> &nbsp; FNXPP3883B</div>
              </td>
              <td colSpan={2} style={{ padding: "2px 4px", fontSize: "7.5pt" }}>TOTAL</td>
              <td colSpan={2} style={{ textAlign: "right", fontWeight: "bold" }}>
                {inrTotal.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ padding: "2px 4px", fontSize: "7.5pt" }}>Shipping Charges ({isItps ? "ITPS" : isEms ? "EMS" : "ITPS"})</td>
              <td colSpan={2} style={{ textAlign: "right" }}>{order.shippingPrice > 0 ? order.shippingPrice.toFixed(2) : ""}</td>
            </tr>
            <tr>
              <td colSpan={2} style={{ padding: "2px 4px", border: "none" }}></td>
              <td colSpan={2} style={{ padding: "2px 4px", fontSize: "7.5pt" }}>Included</td>
              <td colSpan={2}></td>
            </tr>
            <tr>
              <td colSpan={2} style={{ padding: "2px 4px", border: "none" }}></td>
              <td colSpan={2} style={{ padding: "2px 4px", fontSize: "7.5pt" }}>Shipping Charges (EMS)</td>
              <td colSpan={2} style={{ textAlign: "right", fontWeight: "bold" }}></td>
            </tr>
            <tr>
              <td colSpan={2} style={{ padding: "2px 4px", border: "none" }}></td>
              <td colSpan={2} style={{ padding: "2px 4px", fontSize: "7.5pt" }}>Rs</td>
              <td colSpan={2}></td>
            </tr>
            <tr>
              <td colSpan={2} style={{ padding: "2px 4px", border: "none" }}></td>
              <td colSpan={2} style={{ padding: "2px 4px", fontSize: "7.5pt" }}>Total</td>
              <td colSpan={2}></td>
            </tr>
            <tr>
              <td colSpan={2} style={{ padding: "2px 4px", border: "none" }}></td>
              <td colSpan={2} style={{ padding: "2px 4px", fontSize: "7.5pt" }}>Round Off</td>
              <td colSpan={2}></td>
            </tr>
            <tr>
              <td colSpan={2} style={{ padding: "2px 4px", border: "none" }}></td>
              <td colSpan={2} style={{ padding: "2px 4px", fontWeight: "bold", fontSize: "7.5pt" }}>Total Amount</td>
              <td style={{ padding: "2px 4px", fontWeight: "bold", textAlign: "right", fontSize: "7.5pt" }}>INR</td>
              <td style={{ textAlign: "right", fontWeight: "bold", fontSize: "11pt", padding: "2px 4px" }}>
                {order.inrAmount ? Math.round(order.inrAmount).toLocaleString("en-IN") : ""}
              </td>
            </tr>

            {/* USD */}
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
            <tr><td colSpan={14} style={{ padding: "2px 5px", fontSize: "7.5pt" }}>Described and that all particulars are true and correct.</td></tr>
            <tr><td colSpan={14} style={{ padding: "2px 5px", fontSize: "7.5pt" }}>Export under lut without payment of gst at 0%</td></tr>
            <tr><td colSpan={14} style={{ padding: "2px 5px", fontSize: "7.5pt" }}>We declare that this Invoice shows actual price of goods</td></tr>
            <tr><td colSpan={14} style={{ padding: "2px 5px", fontSize: "7.5pt" }}>described and that all particulars are true and correct.</td></tr>

            {/* Total packages */}
            <tr>
              <td colSpan={4} style={{ padding: "3px 5px", fontWeight: "bold", fontSize: "8pt" }}>Total Number and kind of packages</td>
              <td colSpan={10} style={{ padding: "3px 5px", fontSize: "8pt", fontWeight: "bold" }}>
                {isItps && "ITPS 1"}
                {isEms  && "EMS 1"}
                {!isItps && !isEms && `${order.shipmentMode ?? "ITPS"} 1`}
              </td>
            </tr>

            {/* Signature */}
            <tr>
              <td colSpan={14} style={{ height: 50, padding: "4px 8px", verticalAlign: "bottom", textAlign: "right", fontSize: "8.5pt" }}>
                Authorized Signatory
              </td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Order card ───────────────────────────────────────────────────────────────
function OrderCard({
  order, onInvoiceGenerated, onViewInvoice,
}: {
  order: Order;
  onInvoiceGenerated: (id: string, invoiceNo: string) => void;
  onViewInvoice: (order: Order) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState("");

  async function generateInvoice() {
    setGenerating(true); setErr("");
    const res = await fetch("/api/packaging/invoice", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ orderId: order.id }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data?.error || "Failed"); setGenerating(false); return; }
    onInvoiceGenerated(order.id, data.invoiceNo);
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
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {hasInvoice ? (
            <button onClick={() => onViewInvoice(order)} className="btn btn-primary btn-sm">
              📄 View Invoice
            </button>
          ) : (
            <button onClick={generateInvoice} disabled={generating} className="btn btn-primary btn-sm">
              {generating ? "Generating…" : "⚡ Generate Invoice"}
            </button>
          )}
        </div>
      </div>

      {err && <div className="alert alert-error" style={{ marginBottom: "0.5rem", padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}>{err}</div>}

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
            {order.items.map(item => (
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
                  {item.inrUnit != null
                    ? <span className="badge badge-green" style={{ fontSize: "0.7rem" }}>₹{item.inrUnit.toFixed(2)}</span>
                    : <span style={{ color: "#f87171", fontSize: "0.75rem" }}>Missing</span>}
                </td>
                <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>
                  {item.amount != null ? `₹${item.amount.toFixed(2)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid var(--border)" }}>
              <td colSpan={6} style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>Total INR:</td>
              <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 700 }}>₹{order.totalInr.toFixed(2)}</td>
            </tr>
            {order.dollarAmount && (
              <tr>
                <td colSpan={6} style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>Total USD:</td>
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
  const [orders,      setOrders]      = useState<Order[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activeInvoice, setActiveInvoice] = useState<Order | null>(null);
  const [tab,         setTab]         = useState<"ready" | "packing">("ready");

  async function load() {
    setLoading(true);
    const res  = await fetch("/api/packaging/orders");
    const data = await res.json();
    setOrders(data.orders ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const handleInvoiceGenerated = useCallback((id: string, invoiceNo: string) => {
    setOrders(prev => prev.map(o =>
      o.id === id ? { ...o, invoiceNo, status: "PACKING" } : o
    ));
  }, []);

  const handleViewInvoice = useCallback((order: Order) => {
    setActiveInvoice(order);
  }, []);

  const readyOrders   = orders.filter(o => o.status === "PAYMENT_VERIFIED");
  const packingOrders = orders.filter(o => o.status === "PACKING");

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
        <button onClick={load} className="btn btn-secondary btn-sm">↺ Refresh</button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
        {[
          { key: "ready",   label: `⚡ Ready for Invoice (${readyOrders.length})` },
          { key: "packing", label: `📦 In Packing (${packingOrders.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`btn btn-sm ${tab === t.key ? "btn-primary" : "btn-secondary"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1,2].map(i => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 14 }} />)}
        </div>
      ) : (
        <>
          {tab === "ready" && (
            readyOrders.length === 0
              ? <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                  No orders are ready for invoicing yet.<br/>
                  <span style={{ fontSize: "0.8rem" }}>Orders appear here once accounts marks them as PAYMENT_VERIFIED.</span>
                </div>
              : readyOrders.map(o => (
                  <OrderCard
                    key={o.id} order={o}
                    onInvoiceGenerated={handleInvoiceGenerated}
                    onViewInvoice={handleViewInvoice}
                  />
                ))
          )}
          {tab === "packing" && (
            packingOrders.length === 0
              ? <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                  No orders in packing yet.
                </div>
              : packingOrders.map(o => (
                  <OrderCard
                    key={o.id} order={o}
                    onInvoiceGenerated={handleInvoiceGenerated}
                    onViewInvoice={handleViewInvoice}
                  />
                ))
          )}
        </>
      )}

      {/* Invoice overlay */}
      {activeInvoice && (
        <GSTInvoice
          order={activeInvoice}
          onClose={() => setActiveInvoice(null)}
        />
      )}
    </div>
  );
}