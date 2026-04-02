"use client";
import { useState, useEffect } from "react";
import CreditNoteEntryTab from "./CreditNoteEntryTab";

// ── Types ─────────────────────────────────────────────────────────────────────
type Party = {
  id: string; name: string; address: string | null;
  gstNumber: string | null; drugLicenseNumber: string | null;
  notes: string | null; isActive: boolean; createdAt: string;
  phones: { id: string; phone: string }[];
  emails: { id: string; email: string }[];
  _count?: { PurchaseBills: number };
};

type LedgerItem = {
  id: string; productName: string; composition: string | null; pack: string | null;
  batch: string | null; expiry: string | null;
  quantity: number; rate: number; mrp: number | null; discount: number | null;
  gstPercent: number | null; taxableAmount: number | null;
  cgstPercent: number | null; sgstPercent: number | null; igstPercent: number | null;
  cgstAmount: number | null; sgstAmount: number | null; igstAmount: number | null;
};

type LedgerEntry = {
  id: string; kind: "bill" | "payment" | "creditNote";
  date: string; particulars: string; vchType: string; vchNo: string | null;
  debit: number | null; credit: number | null;
  balance: number; balanceType: "Dr" | "Cr";
  // bill-only
  invoiceNo: string | null; invoiceDate: string | null;
  itemCount: number; items: LedgerItem[];
  // payment-only
  mode: string | null; reference: string | null; notes: string | null;
  allocations?: { id: string; amount: number; billId: string | null; invoiceNo: string | null }[];
};

type LedgerData = {
  party: {
    id: string; name: string; address: string | null;
    gstNumber: string | null; drugLicenseNumber: string | null;
    phone: string | null; email: string | null;
  };
  entries: LedgerEntry[];
  summary: {
    billCount: number; paymentCount: number; creditNoteCount: number;
    totalCredit: number; totalDebit: number; totalCreditNotes: number;
    closingBalance: number; balanceType: "Dr" | "Cr";
  };
};

type BillBalance = {
  id: string; invoiceNo: string | null; invoiceDate: string | null;
  createdAt: string; billAmount: number; paidAmount: number; creditNoteAdjusted: number; outstanding: number;
};

const EMPTY = {
  name: "", address: "", gstNumber: "",
  drugLicenseNumber: "", notes: "", phone: "", email: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function today() {
  return new Date().toISOString().split("T")[0];
}

// ── Payment Entry Form ────────────────────────────────────────────────────────
function PaymentEntryTab({ partyId, onAdded }: { partyId: string; onAdded: () => void }) {
  const [bills,      setBills]      = useState<BillBalance[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState("");
  const [success,    setSuccess]    = useState("");
  const [amount,     setAmount]     = useState("");
  const [payDate,    setPayDate]    = useState(today());
  const [mode,       setMode]       = useState("");
  const [reference,  setReference]  = useState("");
  const [notes,      setNotes]      = useState("");
  // allocations: { [billId]: string (amount as string) }
  const [allocs, setAllocs] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/parties/${partyId}/payments`)
      .then(r => r.json())
      .then(d => { setBills(d.bills ?? []); setLoading(false); });
  }, [partyId]);

  const totalPayment  = parseFloat(amount) || 0;
  const totalAllocated = Object.values(allocs).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const remaining      = totalPayment - totalAllocated;

  function toggleBill(bill: BillBalance) {
    setAllocs(prev => {
      const next = { ...prev };
      if (next[bill.id] !== undefined) {
        delete next[bill.id];
      } else {
        // auto-fill: min of outstanding balance and remaining payment
        const autoFill = Math.min(bill.outstanding, Math.max(0, remaining));
        next[bill.id] = autoFill > 0 ? autoFill.toFixed(2) : "";
      }
      return next;
    });
  }

  function setAllocAmount(billId: string, val: string) {
    setAllocs(prev => ({ ...prev, [billId]: val }));
  }

  function clear() {
    setAmount(""); setPayDate(today()); setMode(""); setReference(""); setNotes(""); setAllocs({});
  }

  async function submit() {
    if (!amount || totalPayment <= 0) { setErr("Enter a valid amount"); return; }
    if (totalAllocated > totalPayment + 0.01) { setErr("Allocated amount exceeds payment amount"); return; }

    const allocations = Object.entries(allocs)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([billId, v]) => ({ billId, amount: parseFloat(v) }));

    setSaving(true); setErr(""); setSuccess("");
    const res  = await fetch(`/api/parties/${partyId}/payments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: totalPayment, paymentDate: payDate, mode: mode || null, reference: reference || null, notes: notes || null, allocations }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data?.error || "Failed to save"); setSaving(false); return; }
    setSuccess(`Payment of ${fmt(totalPayment)} recorded.`);
    clear(); setSaving(false); onAdded();
  }

  const outstandingBills = bills.filter(b => b.outstanding > 0.01);

  return (
    <div style={{ padding: "1.5rem", maxWidth: 700 }}>
      <h3 style={{ margin: "0 0 1.25rem", fontSize: "0.95rem", fontWeight: 700 }}>New Payment Entry</h3>

      {err     && <div className="alert alert-error"   style={{ marginBottom: "1rem", fontSize: "0.82rem" }}>{err}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: "1rem", fontSize: "0.82rem" }}>{success}</div>}

      {/* Header fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem", marginBottom: "1.5rem" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
            Payment Amount (₹) <span style={{ color: "#f87171" }}>*</span>
          </label>
          <input
            type="number" min="0" step="0.01"
            value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="e.g. 1400"
            style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "1.1rem" }}
          />
        </div>
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Payment Date</label>
          <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Payment Mode</label>
          <select value={mode} onChange={e => setMode(e.target.value)}>
            <option value="">— Select —</option>
            <option>Cash</option><option>NEFT</option><option>RTGS</option>
            <option>Cheque</option><option>UPI</option><option>Bank Transfer</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Reference / Cheque No.</label>
          <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Transaction ID / cheque no." style={{ fontFamily: "monospace" }} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any remarks…" />
        </div>
      </div>

      {/* Allocation tracker */}
      {totalPayment > 0 && (
        <div style={{
          display: "flex", gap: "1.5rem", padding: "0.6rem 1rem", marginBottom: "1rem",
          background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)",
          fontSize: "0.82rem", flexWrap: "wrap",
        }}>
          <span>Total Payment: <strong style={{ fontFamily: "monospace", color: "#93c5fd" }}>{fmt(totalPayment)}</strong></span>
          <span>Allocated: <strong style={{ fontFamily: "monospace", color: "#6ee7b7" }}>{fmt(totalAllocated)}</strong></span>
          <span style={{ color: remaining < -0.01 ? "#f87171" : remaining < 0.01 ? "#6ee7b7" : "#fcd34d" }}>
            {remaining < -0.01
              ? `Over-allocated: ${fmt(Math.abs(remaining))}`
              : remaining < 0.01
                ? "Fully allocated"
                : `Unallocated (On Account): ${fmt(remaining)}`}
          </span>
        </div>
      )}

      {/* Invoice allocation table */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Allocate Against Invoices {outstandingBills.length === 0 && "(no outstanding invoices)"}
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: 80, borderRadius: 8 }} />
        ) : outstandingBills.length === 0 ? (
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", padding: "0.75rem", border: "1px solid var(--border)", borderRadius: 8 }}>
            No outstanding invoices. Payment will be recorded on account.
          </div>
        ) : (
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: "32px 1fr 100px 90px 90px 110px",
              padding: "0.4rem 0.75rem", background: "var(--surface-2)",
              fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "0.04em",
              borderBottom: "1px solid var(--border)",
            }}>
              <span></span>
              <span>Invoice</span>
              <span style={{ textAlign: "right" }}>Bill Amt</span>
              <span style={{ textAlign: "right" }}>Paid</span>
              <span style={{ textAlign: "right" }}>Outstanding</span>
              <span style={{ textAlign: "right" }}>Allocate (₹)</span>
            </div>

            {outstandingBills.map(bill => {
              const isSelected = allocs[bill.id] !== undefined;
              const allocVal   = allocs[bill.id] ?? "";
              const allocNum   = parseFloat(allocVal) || 0;
              const overAlloc  = allocNum > bill.outstanding + 0.01;

              return (
                <div
                  key={bill.id}
                  style={{
                    display: "grid", gridTemplateColumns: "32px 1fr 100px 90px 90px 110px",
                    padding: "0.55rem 0.75rem", alignItems: "center",
                    borderBottom: "1px solid var(--border)",
                    background: isSelected ? "rgba(99,102,241,0.06)" : "transparent",
                    transition: "background 0.12s",
                  }}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!isSelected && totalPayment > 0 && remaining <= 0.01}
                    onChange={() => toggleBill(bill)}
                    style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#6366f1" }}
                  />

                  {/* Invoice info */}
                  <div>
                    <div style={{ fontFamily: "monospace", fontWeight: 600, fontSize: "0.82rem" }}>
                      {bill.invoiceNo ?? "No Invoice"}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      {fmtDate(bill.invoiceDate ?? bill.createdAt)}
                    </div>
                  </div>

                  {/* Bill amount */}
                  <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {fmt(bill.billAmount)}
                  </div>

                  {/* Paid */}
                  <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: "0.8rem", color: "#6ee7b7" }}>
                    {bill.paidAmount > 0 ? fmt(bill.paidAmount) : "—"}
                  </div>

                  {/* Outstanding */}
                  <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: "0.8rem", fontWeight: 600, color: "#fcd34d" }}>
                    {fmt(bill.outstanding)}
                  </div>

                  {/* Allocate input */}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    {isSelected ? (
                      <input
                        type="number" min="0" step="0.01"
                        value={allocVal}
                        onChange={e => setAllocAmount(bill.id, e.target.value)}
                        style={{
                          width: 100, textAlign: "right", fontFamily: "monospace",
                          fontWeight: 600, fontSize: "0.82rem",
                          border: overAlloc ? "1px solid #f87171" : "1px solid var(--border)",
                          background: overAlloc ? "rgba(248,113,113,0.08)" : "var(--surface-1)",
                          borderRadius: 6, padding: "0.25rem 0.5rem",
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          onClick={submit}
          disabled={saving || totalPayment <= 0 || totalAllocated > totalPayment + 0.01}
          className="btn btn-primary"
        >
          {saving ? "Saving…" : "Record Payment"}
        </button>
        <button onClick={clear} className="btn btn-secondary">Clear</button>
      </div>
    </div>
  );
}

// ── Tally-style Ledger Tab ────────────────────────────────────────────────────
function LedgerTab({ data, reload }: { data: LedgerData; reload: () => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (data.entries.length === 0) {
    return (
      <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--text-muted)" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", opacity: 0.4 }}>📄</div>
        <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>No transactions yet</div>
        <div style={{ fontSize: "0.8rem" }}>Upload purchase bills or add payment entries to see the ledger.</div>
      </div>
    );
  }

  const COL = "36px 100px 110px 1fr 90px 110px 110px 120px";

  return (
    <div>
      {/* ── Ledger table header ── */}
      <div style={{
        display: "grid", gridTemplateColumns: COL,
        padding: "0.5rem 1.25rem",
        borderBottom: "2px solid var(--border)",
        fontSize: "0.68rem", fontWeight: 700,
        color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
        background: "var(--surface-2)",
      }}>
        <span></span>
        <span>Date</span>
        <span>Vch No.</span>
        <span>Particulars</span>
        <span>Vch Type</span>
        <span style={{ textAlign: "right" }}>Debit (Dr)</span>
        <span style={{ textAlign: "right" }}>Credit (Cr)</span>
        <span style={{ textAlign: "right" }}>Balance</span>
      </div>

      {/* Opening balance row */}
      <div style={{
        display: "grid", gridTemplateColumns: COL,
        padding: "0.55rem 1.25rem",
        borderBottom: "1px solid var(--border)",
        background: "rgba(0,0,0,0.15)",
        fontSize: "0.8rem",
      }}>
        <span></span>
        <span style={{ color: "var(--text-muted)" }}>—</span>
        <span></span>
        <span style={{ fontStyle: "italic", color: "var(--text-muted)" }}>Opening Balance</span>
        <span></span>
        <span></span>
        <span></span>
        <span style={{ textAlign: "right", fontFamily: "monospace", color: "var(--text-muted)" }}>₹0.00</span>
      </div>

      {/* ── Ledger rows ── */}
      {data.entries.map((entry, idx) => {
        const isOpen = expanded.has(entry.id);
        const isBill = entry.kind === "bill";

        return (
          <div key={entry.id} style={{ borderBottom: "1px solid var(--border)" }}>
            {/* Main row */}
            <div
              onClick={() => (isBill || (entry.allocations && entry.allocations.length > 0)) && toggle(entry.id)}
              style={{
                display: "grid", gridTemplateColumns: COL,
                padding: "0.6rem 1.25rem",
                alignItems: "center",
                cursor: (isBill || (entry.allocations && entry.allocations.length > 0)) ? "pointer" : "default",
                background: isOpen
                  ? "rgba(99,102,241,0.07)"
                  : isBill
                    ? idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)"
                    : "rgba(52,211,153,0.04)",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => {
                if (!isOpen) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
              }}
              onMouseLeave={e => {
                if (!isOpen) (e.currentTarget as HTMLElement).style.background =
                  isBill
                    ? idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)"
                    : "rgba(52,211,153,0.04)";
              }}
            >
              {/* Expand toggle / payment icon */}
              <span style={{ textAlign: "center", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                {isBill
                ? (isOpen ? "▲" : "▼")
                : (entry.allocations && entry.allocations.length > 0 ? (isOpen ? "▲" : "▼") : "💳")}
              </span>

              {/* Date */}
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                {fmtDate(entry.date)}
              </span>

              {/* Vch No */}
              <span style={{ fontFamily: "monospace", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entry.vchNo ?? <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>—</span>}
              </span>

              {/* Particulars */}
              <span style={{ fontSize: "0.8rem", color: isBill ? "var(--text-secondary)" : "#6ee7b7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entry.particulars || "—"}
              </span>

              {/* Vch Type */}
              <span style={{
                fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: isBill ? "#93c5fd" : "#6ee7b7",
              }}>
                {entry.vchType}
              </span>

              {/* Debit */}
              <span style={{
                textAlign: "right", fontFamily: "monospace",
                fontSize: "0.82rem", fontWeight: entry.debit ? 600 : 400,
                color: entry.debit ? "#fca5a5" : "var(--text-muted)",
              }}>
                {entry.debit != null ? fmt(entry.debit) : "—"}
              </span>

              {/* Credit */}
              <span style={{
                textAlign: "right", fontFamily: "monospace",
                fontSize: "0.82rem", fontWeight: entry.credit ? 600 : 400,
                color: entry.credit ? "#93c5fd" : "var(--text-muted)",
              }}>
                {entry.credit != null ? fmt(entry.credit) : "—"}
              </span>

              {/* Balance */}
              <span style={{
                textAlign: "right", fontFamily: "monospace",
                fontSize: "0.82rem", fontWeight: 700,
                color: entry.balanceType === "Cr" ? "#fcd34d" : "#6ee7b7",
              }}>
                {fmt(Math.abs(entry.balance))}{" "}
                <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>{entry.balanceType}</span>
              </span>
            </div>

            {/* Expanded bill detail */}
            {isOpen && isBill && (
              <div style={{ background: "rgba(59,130,246,0.04)", borderTop: "1px solid var(--border)" }}>
                <div style={{
                  padding: "0.55rem 1.25rem 0.45rem",
                  display: "flex", gap: "2rem", fontSize: "0.75rem", color: "var(--text-secondary)",
                  borderBottom: "1px dashed var(--border)", flexWrap: "wrap",
                }}>
                  <span>Invoice: <strong style={{ fontFamily: "monospace" }}>{entry.invoiceNo ?? "N/A"}</strong></span>
                  <span>Date: <strong>{fmtDate(entry.invoiceDate ?? entry.date)}</strong></span>
                  <span>{entry.itemCount} line item{entry.itemCount !== 1 ? "s" : ""}</span>
                  <span style={{ color: "#93c5fd", fontWeight: 600 }}>Total: {fmt(entry.credit ?? 0)}</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", fontSize: "0.78rem", borderCollapse: "collapse", minWidth: 800 }}>
                    <thead>
                      <tr style={{ background: "rgba(0,0,0,0.18)" }}>
                        {["Product", "Pack", "Batch / Exp", "Qty", "Rate", "MRP", "Disc%", "Taxable", "CGST", "SGST", "IGST", "Total"].map(h => (
                          <th key={h} style={{
                            padding: "0.4rem 0.6rem",
                            textAlign: ["Product","Pack","Batch / Exp"].includes(h) ? "left" : "right",
                            fontSize: "0.67rem", fontWeight: 700, color: "var(--text-muted)",
                            textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entry.items.map(item => {
                        const gst       = (item.cgstAmount ?? 0) + (item.sgstAmount ?? 0) + (item.igstAmount ?? 0);
                        const lineTotal = (item.taxableAmount ?? item.rate * item.quantity) + gst;
                        return (
                          <tr key={item.id} style={{ borderTop: "1px solid var(--border)" }}>
                            <td style={{ padding: "0.45rem 0.6rem" }}>
                              <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.productName}</div>
                              {item.composition && <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{item.composition}</div>}
                            </td>
                            <td style={{ padding: "0.45rem 0.6rem", color: "var(--text-secondary)" }}>{item.pack ?? "—"}</td>
                            <td style={{ padding: "0.45rem 0.6rem", fontFamily: "monospace", fontSize: "0.74rem" }}>
                              <div>{item.batch ?? "—"}</div>
                              {item.expiry && <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Exp: {item.expiry}</div>}
                            </td>
                            <td style={{ padding: "0.45rem 0.6rem", textAlign: "right", fontWeight: 600 }}>{item.quantity}</td>
                            <td style={{ padding: "0.45rem 0.6rem", textAlign: "right", fontFamily: "monospace" }}>₹{item.rate.toFixed(2)}</td>
                            <td style={{ padding: "0.45rem 0.6rem", textAlign: "right", fontFamily: "monospace", color: "var(--text-secondary)" }}>
                              {item.mrp != null ? `₹${item.mrp.toFixed(2)}` : "—"}
                            </td>
                            <td style={{ padding: "0.45rem 0.6rem", textAlign: "right", color: "var(--text-secondary)" }}>
                              {item.discount != null ? `${item.discount}%` : "—"}
                            </td>
                            <td style={{ padding: "0.45rem 0.6rem", textAlign: "right", fontFamily: "monospace" }}>
                              {item.taxableAmount != null ? `₹${item.taxableAmount.toFixed(2)}` : "—"}
                            </td>
                            <td style={{ padding: "0.45rem 0.6rem", textAlign: "right", fontFamily: "monospace", color: "var(--text-secondary)", fontSize: "0.72rem" }}>
                              {item.cgstAmount != null ? `₹${item.cgstAmount.toFixed(2)}` : item.cgstPercent != null ? `${item.cgstPercent}%` : "—"}
                            </td>
                            <td style={{ padding: "0.45rem 0.6rem", textAlign: "right", fontFamily: "monospace", color: "var(--text-secondary)", fontSize: "0.72rem" }}>
                              {item.sgstAmount != null ? `₹${item.sgstAmount.toFixed(2)}` : item.sgstPercent != null ? `${item.sgstPercent}%` : "—"}
                            </td>
                            <td style={{ padding: "0.45rem 0.6rem", textAlign: "right", fontFamily: "monospace", color: "var(--text-secondary)", fontSize: "0.72rem" }}>
                              {item.igstAmount != null ? `₹${item.igstAmount.toFixed(2)}` : item.igstPercent != null ? `${item.igstPercent}%` : "—"}
                            </td>
                            <td style={{ padding: "0.45rem 0.6rem", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#93c5fd" }}>
                              ₹{lineTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Expanded payment allocation detail */}
            {isOpen && !isBill && entry.allocations && entry.allocations.length > 0 && (
              <div style={{ background: "rgba(52,211,153,0.04)", borderTop: "1px solid var(--border)", padding: "0.6rem 1.25rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.5rem" }}>
                  Invoice Allocations
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  {entry.allocations.map(a => (
                    <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem" }}>
                      <span style={{ color: "var(--text-secondary)" }}>
                        {a.invoiceNo
                          ? <><span style={{ fontFamily: "monospace", fontWeight: 600 }}>{a.invoiceNo}</span></>
                          : <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>On Account</span>}
                      </span>
                      <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#6ee7b7" }}>{fmt(a.amount)}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--border)", paddingTop: "0.3rem", marginTop: "0.1rem", fontSize: "0.8rem", fontWeight: 700 }}>
                    <span style={{ color: "var(--text-secondary)" }}>Total Allocated</span>
                    <span style={{ fontFamily: "monospace", color: "#6ee7b7" }}>{fmt(entry.allocations.reduce((s, a) => s + a.amount, 0))}</span>
                  </div>
                  {entry.debit != null && entry.allocations.reduce((s, a) => s + a.amount, 0) < entry.debit - 0.01 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                      <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>On Account (unallocated)</span>
                      <span style={{ fontFamily: "monospace", color: "#fcd34d" }}>{fmt(entry.debit - entry.allocations.reduce((s, a) => s + a.amount, 0))}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Closing Balance footer ── */}
      <div style={{
        display: "grid", gridTemplateColumns: COL,
        padding: "0.875rem 1.25rem",
        background: "var(--surface-2)",
        borderTop: "2px solid var(--border)",
        position: "sticky", bottom: 0,
      }}>
        <span></span>
        <span></span>
        <span></span>
        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)" }}>
          Closing Balance
        </span>
        <span></span>
        <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#fca5a5" }}>
          {fmt(data.summary.totalDebit)}
        </span>
        <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#93c5fd" }}>
          {fmt(data.summary.totalCredit)}
        </span>
        <span style={{
          textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: "0.95rem",
          color: data.summary.balanceType === "Cr" ? "#fcd34d" : "#6ee7b7",
        }}>
          {fmt(Math.abs(data.summary.closingBalance))}{" "}
          <span style={{ fontSize: "0.72rem" }}>{data.summary.balanceType}</span>
        </span>
      </div>
    </div>
  );
}

// ── Ledger Overlay ────────────────────────────────────────────────────────────
function LedgerOverlay({
  partyId, partyName, onClose,
}: { partyId: string; partyName: string; onClose: () => void }) {
  const [tab,     setTab]     = useState<"ledger" | "payment" | "creditNote">("ledger");
  const [data,    setData]    = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");

  async function load() {
    setLoading(true); setErr("");
    const res  = await fetch(`/api/parties/${partyId}/ledger`);
    const json = await res.json();
    if (!res.ok) { setErr(json?.error || "Failed to load ledger"); setLoading(false); return; }
    setData(json);
    setLoading(false);
  }

  useEffect(() => { load(); }, [partyId]);

  // Sticky header height — recalculate after data loads
  const headerH = data ? (data.party.gstNumber || data.party.phone ? 120 : 90) : 90;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "stretch",
    }}>
      <div style={{ flex: 1 }} onClick={onClose} />

      <div style={{
        width: "min(1140px, 96vw)", background: "var(--surface-1)",
        borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* ── Top header ── */}
        <div style={{
          padding: "1.1rem 1.5rem 0", borderBottom: "1px solid var(--border)",
          position: "sticky", top: 0, background: "var(--surface-1)", zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "0.75rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>{partyName}</h2>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 4 }}>
                  Party Ledger
                </span>
              </div>
              {data && (
                <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.78rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                  {data.party.gstNumber && (
                    <span style={{ color: "var(--text-secondary)" }}>
                      GST: <strong style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>{data.party.gstNumber}</strong>
                    </span>
                  )}
                  {data.party.phone && <span style={{ color: "var(--text-secondary)" }}>📞 {data.party.phone}</span>}
                  {data.party.address && <span style={{ color: "var(--text-muted)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {data.party.address}</span>}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.5rem", cursor: "pointer", flexShrink: 0, lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {/* Summary chips */}
          {data && (
            <div style={{ display: "flex", gap: "1.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
              {[
                { label: "Total Purchases (Cr)", value: fmt(data.summary.totalCredit), color: "#93c5fd" },
                { label: "Total Payments (Dr)", value: fmt(data.summary.totalDebit), color: "#fca5a5" },
                { label: "Credit Notes", value: fmt(data.summary.totalCreditNotes), color: "#fb923c" },
                { label: "Balance", value: `${fmt(Math.abs(data.summary.closingBalance))} ${data.summary.balanceType}`, color: "#fcd34d" },
                { label: "Bills", value: `${data.summary.billCount}`, color: "var(--text-secondary)" },
                { label: "Payments", value: `${data.summary.paymentCount}`, color: "var(--text-secondary)" },
                { label: "CN Count", value: `${data.summary.creditNoteCount}`, color: "var(--text-secondary)" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
                  <span style={{ fontSize: "0.88rem", fontWeight: 700, color, fontFamily: "monospace" }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tab bar */}
          <div style={{ display: "flex", gap: "0", borderTop: "1px solid var(--border)" }}>
            {([["ledger", "📒 Ledger"], ["payment", "💳 Payment Entry"]] as const).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "0.6rem 1.25rem", fontSize: "0.82rem", fontWeight: 600,
                  background: "none", border: "none", cursor: "pointer",
                  borderBottom: tab === t ? "2px solid #6366f1" : "2px solid transparent",
                  color: tab === t ? "#818cf8" : "var(--text-muted)",
                  transition: "color 0.15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1 }}>
          {loading ? (
            <div style={{ padding: "2rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />)}
            </div>
          ) : err ? (
            <div className="alert alert-error" style={{ margin: "1.5rem" }}>{err}</div>
          ) : tab === "ledger" && data ? (
            <LedgerTab data={data} reload={load} />
          ) : tab === "payment" ? (
            <PaymentEntryTab
              partyId={partyId}
              onAdded={() => { load(); setTab("ledger"); }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PartyMasterClient() {
  const [parties,     setParties]     = useState<Party[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [modal,       setModal]       = useState<"add" | "edit" | null>(null);
  const [editing,     setEditing]     = useState<Party | null>(null);
  const [form,        setForm]        = useState({ ...EMPTY });
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState("");
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [ledgerParty, setLedgerParty] = useState<{ id: string; name: string } | null>(null);

  async function load() {
    setLoading(true);
    const res  = await fetch("/api/parties");
    const data = await res.json();
    setParties(data.parties ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function openAdd() { setForm({ ...EMPTY }); setEditing(null); setErr(""); setModal("add"); }

  function openEdit(p: Party) {
    setForm({
      name:              p.name,
      address:           p.address           ?? "",
      gstNumber:         p.gstNumber         ?? "",
      drugLicenseNumber: p.drugLicenseNumber ?? "",
      notes:             p.notes             ?? "",
      phone:             p.phones[0]?.phone  ?? "",
      email:             p.emails[0]?.email  ?? "",
    });
    setEditing(p); setErr(""); setModal("edit");
  }

  async function save() {
    if (!form.name.trim()) { setErr("Party name is required"); return; }
    setSaving(true); setErr("");
    const url    = editing ? `/api/parties/${editing.id}` : "/api/parties";
    const method = editing ? "PATCH" : "POST";
    const res    = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data?.error || "Save failed"); setSaving(false); return; }
    setModal(null); setSaving(false); load();
  }

  async function del(id: string) {
    if (!confirm("Deactivate this party?")) return;
    await fetch(`/api/parties/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = parties.filter(p =>
    [p.name, p.gstNumber, p.drugLicenseNumber, p.address,
     ...p.phones.map(x => x.phone), ...p.emails.map(x => x.email)]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1>Party Master</h1>
          <p style={{ marginTop: "0.25rem" }}>{parties.length} suppliers / parties</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, GST, phone…"
            style={{ padding: "0.5rem 0.75rem", minWidth: 220, fontSize: "0.875rem" }}
          />
          <button onClick={openAdd} className="btn btn-primary">+ Add Party</button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
          {search ? "No parties match your search." : "No parties yet. Add one or scan a purchase bill."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {filtered.map(p => (
            <div key={p.id} className="card" style={{ padding: "0.875rem 1rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                    <button
                      onClick={() => setLedgerParty({ id: p.id, name: p.name })}
                      style={{
                        background: "none", border: "none", padding: 0, cursor: "pointer",
                        fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)",
                        textDecoration: "underline", textDecorationStyle: "dotted",
                        textUnderlineOffset: "3px", textDecorationColor: "var(--text-muted)",
                      }}
                    >
                      {p.name}
                    </button>
                    {p._count?.PurchaseBills
                      ? <span className="badge badge-blue" style={{ fontSize: "0.65rem" }}>{p._count.PurchaseBills} bills</span>
                      : <span className="badge badge-gray" style={{ fontSize: "0.65rem" }}>No bills</span>}
                    {!p.isActive && <span className="badge" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", fontSize: "0.65rem" }}>Inactive</span>}
                  </div>
                  <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    {p.gstNumber && (
                      <span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>GST </span>
                        <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--text-primary)" }}>{p.gstNumber}</span>
                      </span>
                    )}
                    {p.drugLicenseNumber && (
                      <span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>DL </span>
                        <span style={{ fontFamily: "monospace" }}>{p.drugLicenseNumber}</span>
                      </span>
                    )}
                    {p.phones[0] && <span>📞 {p.phones[0].phone}</span>}
                    {p.emails[0] && <span>✉ {p.emails[0].email}</span>}
                    {p.address && (
                      <span style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        📍 {p.address}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.375rem", alignItems: "center", flexShrink: 0 }}>
                  <button onClick={() => setLedgerParty({ id: p.id, name: p.name })} className="btn btn-secondary btn-sm" style={{ fontSize: "0.75rem" }}>
                    📒 Ledger
                  </button>
                  <button onClick={() => setExpanded(expanded === p.id ? null : p.id)} className="btn btn-secondary btn-sm" style={{ fontSize: "0.75rem" }}>
                    {expanded === p.id ? "▲ Less" : "▼ More"}
                  </button>
                  <button onClick={() => openEdit(p)} className="btn btn-secondary btn-sm">Edit</button>
                  <button
                    onClick={() => del(p.id)}
                    className="btn btn-sm"
                    style={{ color: "#f87171", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expanded === p.id && (
                <div style={{
                  marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)",
                  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "0.75rem", fontSize: "0.8rem",
                }}>
                  <div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>PARTY ID</div>
                    <div style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "var(--text-secondary)" }}>{p.id}</div>
                  </div>
                  {p.gstNumber && (
                    <div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>GST NUMBER</div>
                      <div style={{ fontFamily: "monospace", fontWeight: 600 }}>{p.gstNumber}</div>
                    </div>
                  )}
                  {p.drugLicenseNumber && (
                    <div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>DRUG LICENSE</div>
                      <div style={{ fontFamily: "monospace" }}>{p.drugLicenseNumber}</div>
                    </div>
                  )}
                  {p.phones.map(ph => (
                    <div key={ph.id}>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>PHONE</div>
                      <div>{ph.phone}</div>
                    </div>
                  ))}
                  {p.emails.map(em => (
                    <div key={em.id}>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>EMAIL</div>
                      <div>{em.email}</div>
                    </div>
                  ))}
                  {p.address && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>ADDRESS</div>
                      <div>{p.address}</div>
                    </div>
                  )}
                  {p.notes && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>NOTES</div>
                      <div>{p.notes}</div>
                    </div>
                  )}
                  <div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>ADDED ON</div>
                    <div>{new Date(p.createdAt).toLocaleDateString("en-IN")}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth: 560, width: "100%" }}>
            <div className="modal-header">
              <h3>{modal === "add" ? "Add Party" : "Edit Party"}</h3>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.25rem", cursor: "pointer" }}>✕</button>
            </div>
            <div className="modal-body">
              {err && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{err}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Party / Company Name *</label>
                  <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. GUPTA DRUG AGENCIES" />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>GST Number</label>
                  <input value={form.gstNumber} onChange={e => set("gstNumber", e.target.value)} placeholder="27XXXXX" style={{ fontFamily: "monospace" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Drug License Number</label>
                  <input value={form.drugLicenseNumber} onChange={e => set("drugLicenseNumber", e.target.value)} placeholder="20B-MH-NG2-XXXXX" style={{ fontFamily: "monospace" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Phone</label>
                  <input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="Phone number" />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Email</label>
                  <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@example.com" />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Address</label>
                  <input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Full address" />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Notes</label>
                  <input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any notes" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setModal(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn btn-primary">
                {saving ? "Saving…" : modal === "add" ? "Add Party" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Overlay */}
      {ledgerParty && (
        <LedgerOverlay
          partyId={ledgerParty.id}
          partyName={ledgerParty.name}
          onClose={() => setLedgerParty(null)}
        />
      )}
    </div>
  );
}
