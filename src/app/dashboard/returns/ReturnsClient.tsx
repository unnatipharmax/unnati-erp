"use client";
import { useState, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
type ReturnItem = {
  id?:          string;
  productId:    string;
  productName:  string;
  pack:         string | null;
  quantity:     number;
  sellingPrice: number;
};

type ReturnRecord = {
  id:              string;
  returnDate:      string;
  reason:          string | null;
  trackingReturned: string | null;
  returnType:      "REORDER" | "STOCK_RETURN";
  newShippingCost: number | null;
  newShippingMode: string | null;
  newOrderId:      string | null;
  newInvoiceNo:    string | null;
  notes:           string | null;
  createdAt:       string;
  originalOrder: {
    id:           string;
    invoiceNo:    string | null;
    fullName:     string;
    email:        string;
    country:      string;
    currency:     string;
    accountId:    string | null;
    shipmentMode: string | null;
    shippingPrice: number | null;
  };
  items: ReturnItem[];
};

type Invoice = {
  id:        string;
  invoiceNo: string;
  fullName:  string;
  email:     string;
  country:   string;
  currency:  string;
  accountId: string | null;
  orderEntry: {
    shipmentMode:  string;
    shippingPrice: number;
    items: ReturnItem[];
  } | null;
};

const SHIPMENT_MODES = ["EMS", "ITPS", "RMS", "DHL", "UPS", "CM"];

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Record Return Modal ────────────────────────────────────────────────────────
function RecordReturnModal({
  onClose, onSaved,
}: { onClose: () => void; onSaved: () => void }) {

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — invoice search
  const [search,   setSearch]   = useState("");
  const [results,  setResults]  = useState<Invoice[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);

  // Step 2 — items / return details
  const [items,      setItems]      = useState<ReturnItem[]>([]);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [reason,     setReason]     = useState("");
  const [tracking,   setTracking]   = useState("");
  const [notes,      setNotes]      = useState("");

  // Step 3 — return type
  const [returnType,      setReturnType]      = useState<"REORDER" | "STOCK_RETURN">("REORDER");
  const [newShippingCost, setNewShippingCost] = useState("");
  const [newShippingMode, setNewShippingMode] = useState("EMS");

  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");
  const [done,   setDone]   = useState<{ type: string; newInvoiceNo?: string } | null>(null);

  // Search invoices
  useEffect(() => {
    if (search.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const res  = await fetch(`/api/invoices?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      setResults(data.orders ?? []);
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  function selectInvoice(inv: Invoice) {
    setSelected(inv);
    setResults([]);
    setSearch(inv.invoiceNo);
    // Pre-fill items from original order
    setItems(
      (inv.orderEntry?.items ?? []).map(i => ({
        productId:    i.productId,
        productName:  i.productName,
        pack:         i.pack,
        quantity:     i.quantity,
        sellingPrice: i.sellingPrice,
      }))
    );
    // Pre-fill shipping mode
    if (inv.orderEntry?.shipmentMode) setNewShippingMode(inv.orderEntry.shipmentMode);
    setStep(2);
  }

  function updateItemQty(idx: number, qty: number) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, qty) } : it));
  }
  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (!selected) return;
    if (items.length === 0) { setErr("Add at least one returned item."); return; }
    if (returnType === "REORDER" && (!newShippingCost || Number(newShippingCost) <= 0)) {
      setErr("Enter new shipping cost for REORDER."); return;
    }
    setSaving(true); setErr("");

    const res = await fetch("/api/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalOrderId: selected.id,
        returnDate,
        reason:          reason || null,
        trackingReturned: tracking || null,
        returnType,
        newShippingCost: returnType === "REORDER" ? Number(newShippingCost) : null,
        newShippingMode: returnType === "REORDER" ? newShippingMode : null,
        notes:           notes || null,
        items,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setErr(data?.error || "Failed"); return; }
    setDone({ type: returnType, newInvoiceNo: data.newInvoiceNo });
  }

  const iS: React.CSSProperties = { width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "0.85rem", boxSizing: "border-box" };
  const lS: React.CSSProperties = { fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 3, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "var(--surface-1)", borderRadius: 14, width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto", padding: "1.5rem", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem" }}>Record Returned Export Goods</h2>
            {!done && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                {[1, 2, 3].map(s => (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, background: step >= s ? "var(--accent)" : "var(--surface-2)", color: step >= s ? "#fff" : "var(--text-muted)" }}>{s}</div>
                    <span style={{ fontSize: "0.7rem", color: step === s ? "var(--text-primary)" : "var(--text-muted)" }}>
                      {s === 1 ? "Find Invoice" : s === 2 ? "Return Details" : "Action"}
                    </span>
                    {s < 3 && <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>›</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.4rem", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {/* ── DONE state ── */}
        {done && (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>{done.type === "REORDER" ? "📦" : "🏭"}</div>
            <h3 style={{ margin: "0 0 0.5rem" }}>
              {done.type === "REORDER" ? "Reorder Invoice Created!" : "Stock Return Recorded!"}
            </h3>
            {done.newInvoiceNo && (
              <div style={{ fontFamily: "monospace", fontSize: "1.1rem", color: "#818cf8", fontWeight: 700, marginBottom: "0.5rem" }}>
                {done.newInvoiceNo}
              </div>
            )}
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
              {done.type === "REORDER"
                ? "A new invoice has been created with only the shipping cost. It is ready for dispatch in Packaging."
                : "The returned goods have been logged as returned stock inventory for future supply."}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => { onSaved(); onClose(); }} className="btn btn-primary">Done</button>
              <button onClick={() => { setDone(null); setStep(1); setSearch(""); setSelected(null); setItems([]); setReason(""); setTracking(""); setNotes(""); setNewShippingCost(""); setErr(""); }} className="btn btn-secondary">Record Another</button>
            </div>
          </div>
        )}

        {/* ── STEP 1: Find invoice ── */}
        {!done && step === 1 && (
          <div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
              Search for the original invoice that was returned.
            </p>
            <label style={lS}>Search Invoice No / Client Name</label>
            <div style={{ position: "relative" }}>
              <input
                style={iS}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type invoice number or client name…"
                autoFocus
              />
              {searching && (
                <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: "0.75rem", color: "var(--text-muted)" }}>searching…</div>
              )}
            </div>
            {results.length > 0 && (
              <div style={{ marginTop: 6, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                {results.slice(0, 8).map(inv => (
                  <div key={inv.id} onClick={() => selectInvoice(inv)}
                    style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(99,102,241,0.1)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "var(--surface-2)")}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#818cf8" }}>{inv.invoiceNo}</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{inv.country} · {inv.currency}</span>
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: 2 }}>{inv.fullName} · {inv.email}</div>
                    {inv.orderEntry && (
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                        {inv.orderEntry.items.length} item(s) · {inv.orderEntry.shipmentMode} · {inv.orderEntry.shippingPrice} {inv.currency}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {search.length >= 2 && !searching && results.length === 0 && (
              <div style={{ marginTop: 8, fontSize: "0.8rem", color: "var(--text-muted)" }}>No invoices found.</div>
            )}
          </div>
        )}

        {/* ── STEP 2: Return details + items ── */}
        {!done && step === 2 && selected && (
          <div>
            {/* Original invoice info */}
            <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "10px 14px", marginBottom: "1rem", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#818cf8", fontSize: "0.95rem" }}>{selected.invoiceNo}</span>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: 2 }}>{selected.fullName} · {selected.country}</div>
                </div>
                <button onClick={() => { setStep(1); setSelected(null); }} style={{ fontSize: "0.72rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>change</button>
              </div>
            </div>

            {/* Return date + tracking */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: "1rem" }}>
              <div>
                <label style={lS}>Return Date</label>
                <input type="date" style={iS} value={returnDate} onChange={e => setReturnDate(e.target.value)} />
              </div>
              <div>
                <label style={lS}>Returned Parcel Tracking No</label>
                <input style={{ ...iS, fontFamily: "monospace" }} value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Tracking number (optional)" />
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={lS}>Return Reason</label>
              <input style={iS} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Customs held, wrong address, refused delivery…" />
            </div>

            {/* Returned items */}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ ...lS, marginBottom: 0 }}>Returned Items (edit quantities if partial)</label>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{items.length} item(s)</span>
              </div>
              {items.map((item, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 90px 28px", gap: 8, alignItems: "center", marginBottom: 6, background: "var(--surface-2)", borderRadius: 7, padding: "8px 10px", border: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontSize: "0.83rem", fontWeight: 600 }}>{item.productName}</div>
                    {item.pack && <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{item.pack} · {item.sellingPrice} {selected.currency}/unit</div>}
                  </div>
                  <div>
                    <label style={{ ...lS, marginBottom: 2, fontSize: "0.65rem" }}>Qty returned</label>
                    <input type="number" min={1} style={{ ...iS, textAlign: "right" }}
                      value={item.quantity} onChange={e => updateItemQty(idx, parseInt(e.target.value) || 1)} />
                  </div>
                  <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "1.1rem", marginTop: 14 }}>×</button>
                </div>
              ))}
              {items.length === 0 && (
                <div style={{ fontSize: "0.8rem", color: "#f87171" }}>No items — please go back and select a valid invoice.</div>
              )}
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={lS}>Internal Notes (optional)</label>
              <textarea style={{ ...iS, resize: "vertical", minHeight: 52 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes about this return…" />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(1)} className="btn btn-secondary" style={{ flex: 1 }}>← Back</button>
              <button onClick={() => { if (items.length > 0) setStep(3); }} className="btn btn-primary" style={{ flex: 2 }} disabled={items.length === 0}>
                Next: Choose Action →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Return type ── */}
        {!done && step === 3 && selected && (
          <div>
            {/* Summary */}
            <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "10px 14px", marginBottom: "1.25rem", border: "1px solid var(--border)", fontSize: "0.82rem" }}>
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#818cf8" }}>{selected.invoiceNo}</span>
              <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>{selected.fullName} · {items.length} item(s) returned</span>
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
              What should happen to these returned goods?
            </p>

            {/* Option cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "1.25rem" }}>

              {/* REORDER card */}
              <div
                onClick={() => setReturnType("REORDER")}
                style={{ borderRadius: 10, border: `2px solid ${returnType === "REORDER" ? "#818cf8" : "var(--border)"}`, padding: "1rem 1.1rem", cursor: "pointer", background: returnType === "REORDER" ? "rgba(99,102,241,0.08)" : "var(--surface-2)", transition: "all 0.15s" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <div style={{ fontSize: "1.5rem" }}>📦</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: returnType === "REORDER" ? "#818cf8" : "var(--text-primary)" }}>
                      Client Wants Reorder
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>New invoice created · client pays only new shipping cost</div>
                  </div>
                  <div style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", border: `2px solid ${returnType === "REORDER" ? "#818cf8" : "var(--border)"}`, background: returnType === "REORDER" ? "#818cf8" : "transparent" }} />
                </div>

                {returnType === "REORDER" && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(99,102,241,0.2)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={lS}>New Shipping Cost ({selected.currency})</label>
                        <input type="number" min={0} step="0.01" style={iS}
                          value={newShippingCost} onChange={e => setNewShippingCost(e.target.value)}
                          placeholder="e.g. 310" autoFocus />
                      </div>
                      <div>
                        <label style={lS}>Shipping Mode</label>
                        <select style={iS} value={newShippingMode} onChange={e => setNewShippingMode(e.target.value)}>
                          {SHIPMENT_MODES.map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: "0.75rem", color: "#818cf8", background: "rgba(99,102,241,0.08)", padding: "6px 10px", borderRadius: 6 }}>
                      ✓ A new invoice will be generated automatically. Same products, client pays only the new shipping cost.
                      {selected.accountId && " Ledger will be updated with the shipping charge."}
                    </div>
                  </div>
                )}
              </div>

              {/* STOCK_RETURN card */}
              <div
                onClick={() => setReturnType("STOCK_RETURN")}
                style={{ borderRadius: 10, border: `2px solid ${returnType === "STOCK_RETURN" ? "#6ee7b7" : "var(--border)"}`, padding: "1rem 1.1rem", cursor: "pointer", background: returnType === "STOCK_RETURN" ? "rgba(110,231,183,0.06)" : "var(--surface-2)", transition: "all 0.15s" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: "1.5rem" }}>🏭</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: returnType === "STOCK_RETURN" ? "#6ee7b7" : "var(--text-primary)" }}>
                      Client Does Not Want Reorder
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Goods return to warehouse stock · no money refunded to client</div>
                  </div>
                  <div style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", border: `2px solid ${returnType === "STOCK_RETURN" ? "#6ee7b7" : "var(--border)"}`, background: returnType === "STOCK_RETURN" ? "#6ee7b7" : "transparent" }} />
                </div>
                {returnType === "STOCK_RETURN" && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(110,231,183,0.2)", fontSize: "0.75rem", color: "#6ee7b7", background: "rgba(110,231,183,0.06)", padding: "6px 10px", borderRadius: 6 }}>
                    ✓ Returned items will be logged as returned inventory available for future supply. No new invoice will be created.
                  </div>
                )}
              </div>
            </div>

            {err && <div className="alert alert-error" style={{ marginBottom: "0.75rem", fontSize: "0.8rem" }}>{err}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(2)} className="btn btn-secondary" style={{ flex: 1 }}>← Back</button>
              <button onClick={submit} disabled={saving} className="btn btn-primary" style={{ flex: 2 }}>
                {saving ? "Processing…" : returnType === "REORDER" ? "📦 Create Reorder Invoice" : "🏭 Record Stock Return"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Return card ────────────────────────────────────────────────────────────────
function ReturnCard({ r }: { r: ReturnRecord }) {
  const [expanded, setExpanded] = useState(false);
  const isReorder = r.returnType === "REORDER";

  return (
    <div className="card" style={{ padding: "0.875rem 1rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#818cf8", fontSize: "0.9rem" }}>
              {r.originalOrder.invoiceNo}
            </span>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "2px 8px", borderRadius: 4,
              background: isReorder ? "rgba(99,102,241,0.12)" : "rgba(110,231,183,0.12)",
              color:      isReorder ? "#818cf8" : "#6ee7b7",
            }}>
              {isReorder ? "📦 Reorder" : "🏭 Stock Return"}
            </span>
            {r.newInvoiceNo && (
              <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#6ee7b7", background: "rgba(110,231,183,0.08)", padding: "2px 6px", borderRadius: 4 }}>
                → {r.newInvoiceNo}
              </span>
            )}
          </div>

          <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: 4 }}>
            {r.originalOrder.fullName}
          </div>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
            <span>📅 Returned: {fmtDate(r.returnDate)}</span>
            <span>📍 {r.originalOrder.country}</span>
            {r.trackingReturned && <span style={{ fontFamily: "monospace" }}>📬 {r.trackingReturned}</span>}
            {isReorder && r.newShippingCost && (
              <span style={{ color: "#818cf8" }}>
                Shipping: {r.originalOrder.currency} {r.newShippingCost} · {r.newShippingMode}
              </span>
            )}
          </div>

          {r.reason && (
            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: 4 }}>
              Reason: {r.reason}
            </div>
          )}
        </div>

        <button onClick={() => setExpanded(e => !e)} className="btn btn-secondary btn-sm" style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>
          {expanded ? "Hide items ▲" : `${r.items.length} item(s) ▼`}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Returned Items</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {r.items.map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", background: "var(--surface-2)", borderRadius: 6, padding: "6px 10px" }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{item.productName}</span>
                  {item.pack && <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>{item.pack}</span>}
                </div>
                <div style={{ display: "flex", gap: 12, color: "var(--text-secondary)", fontFamily: "monospace" }}>
                  <span>Qty: {item.quantity}</span>
                  <span>{r.originalOrder.currency} {item.sellingPrice}/unit</span>
                </div>
              </div>
            ))}
          </div>
          {r.notes && (
            <div style={{ marginTop: 8, fontSize: "0.76rem", color: "var(--text-muted)", fontStyle: "italic" }}>
              Note: {r.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Returned Stock Summary ─────────────────────────────────────────────────────
function StockSummary({ returns }: { returns: ReturnRecord[] }) {
  // Aggregate returned stock (STOCK_RETURN only)
  const stockMap: Record<string, { productName: string; totalQty: number; returns: number }> = {};
  returns
    .filter(r => r.returnType === "STOCK_RETURN")
    .forEach(r => {
      r.items.forEach(item => {
        if (!stockMap[item.productId]) {
          stockMap[item.productId] = { productName: item.productName, totalQty: 0, returns: 0 };
        }
        stockMap[item.productId].totalQty += item.quantity;
        stockMap[item.productId].returns  += 1;
      });
    });
  const entries = Object.entries(stockMap);
  if (entries.length === 0) return null;

  return (
    <div className="card" style={{ padding: "1rem", marginBottom: "1.25rem", border: "1px solid rgba(110,231,183,0.25)", background: "rgba(110,231,183,0.04)" }}>
      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#6ee7b7", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
        🏭 Returned Stock Available for Future Supply
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
        {entries.map(([pid, v]) => (
          <div key={pid} style={{ background: "var(--surface-2)", borderRadius: 7, padding: "8px 12px", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: 2 }}>{v.productName}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              <span style={{ color: "#6ee7b7", fontWeight: 700, fontSize: "1rem" }}>{v.totalQty}</span> units
              <span style={{ marginLeft: 6 }}>from {v.returns} return(s)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ReturnsClient() {
  const [returns,  setReturns]  = useState<ReturnRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<"all" | "REORDER" | "STOCK_RETURN">("all");
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/returns${search ? `?search=${encodeURIComponent(search)}` : ""}`);
    const data = await res.json();
    setReturns(data.returns ?? []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const filtered = filter === "all" ? returns : returns.filter(r => r.returnType === filter);

  const counts = {
    reorder: returns.filter(r => r.returnType === "REORDER").length,
    stock:   returns.filter(r => r.returnType === "STOCK_RETURN").length,
  };

  return (
    <div>
      {showModal && (
        <RecordReturnModal onClose={() => setShowModal(false)} onSaved={load} />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1>Returned Export Goods</h1>
          <p style={{ marginTop: "0.25rem", color: "var(--text-secondary)" }}>
            Track returned shipments — reorder or move back to warehouse stock
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          + Record Return
        </button>
      </div>

      {/* KPI chips */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {([
          ["all",          "All Returns",   returns.length, "var(--text-secondary)"],
          ["REORDER",      "📦 Reordered",  counts.reorder, "#818cf8"],
          ["STOCK_RETURN", "🏭 Stock Return", counts.stock, "#6ee7b7"],
        ] as const).map(([key, label, count, color]) => (
          <button key={key} onClick={() => setFilter(key)}
            style={{ padding: "4px 14px", borderRadius: 20, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", border: "1px solid",
              background:  filter === key ? `${color}20` : "var(--surface-2)",
              color:       filter === key ? color : "var(--text-muted)",
              borderColor: filter === key ? color : "var(--border)",
            }}>
            {label} <span style={{ fontFamily: "monospace", marginLeft: 4 }}>{count}</span>
          </button>
        ))}
      </div>

      {/* Stock summary */}
      <StockSummary returns={returns} />

      {/* Search */}
      <div style={{ marginBottom: "1rem" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by invoice no, client name, tracking…"
          style={{ width: "100%", maxWidth: 400, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "0.85rem", boxSizing: "border-box" }}
        />
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem", opacity: 0.4 }}>📦</div>
          <div style={{ fontWeight: 600 }}>{returns.length === 0 ? "No returns recorded yet" : "No returns match this filter"}</div>
          <div style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
            Click "+ Record Return" to log a returned shipment.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {filtered.map(r => <ReturnCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}
