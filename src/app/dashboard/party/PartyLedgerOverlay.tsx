"use client";

import { useEffect, useState } from "react";
import CreditNoteEntryTab from "./CreditNoteEntryTab";

type Allocation = { id: string; amount: number; billId: string | null; invoiceNo: string | null };
type LedgerEntry = {
  id: string;
  kind: "bill" | "payment" | "creditNote";
  date: string;
  particulars: string;
  vchType: string;
  vchNo: string | null;
  debit: number | null;
  credit: number | null;
  balance: number;
  balanceType: "Dr" | "Cr";
  allocations?: Allocation[];
};
type LedgerData = {
  party: { id: string; name: string; address: string | null; gstNumber: string | null; phone: string | null };
  entries: LedgerEntry[];
  summary: {
    billCount: number;
    paymentCount: number;
    creditNoteCount: number;
    totalCredit: number;
    totalDebit: number;
    totalCreditNotes: number;
    closingBalance: number;
    balanceType: "Dr" | "Cr";
  };
};
type BillBalance = {
  id: string;
  invoiceNo: string | null;
  invoiceDate: string | null;
  createdAt: string;
  billAmount: number;
  paidAmount: number;
  creditNoteAdjusted: number;
  outstanding: number;
};

function fmt(amount: number) {
  return "Rs. " + amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function PaymentEntryTab({ partyId, onAdded }: { partyId: string; onAdded: () => void }) {
  const [bills, setBills] = useState<BillBalance[]>([]);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [mode, setMode] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [allocs, setAllocs] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/parties/${partyId}/payments`).then((res) => res.json()).then((data) => setBills(data.bills ?? []));
  }, [partyId]);

  async function submit() {
    const total = parseFloat(amount) || 0;
    const allocations = Object.entries(allocs)
      .filter(([, value]) => parseFloat(value) > 0)
      .map(([billId, value]) => ({ billId, amount: parseFloat(value) }));

    if (total <= 0) {
      setErr("Enter a valid payment amount.");
      return;
    }

    setSaving(true);
    setErr("");
    const res = await fetch(`/api/parties/${partyId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: total, paymentDate, mode: mode || null, reference: reference || null, notes: notes || null, allocations }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data?.error || "Failed to record payment");
      setSaving(false);
      return;
    }
    setAmount("");
    setPaymentDate(today());
    setMode("");
    setReference("");
    setNotes("");
    setAllocs({});
    setSaving(false);
    onAdded();
  }

  return (
    <div style={{ padding: "1.5rem", display: "grid", gap: "1rem", maxWidth: 900 }}>
      {err && <div className="alert alert-error">{err}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "0.75rem" }}>
        <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
        <input placeholder="Mode" value={mode} onChange={(e) => setMode(e.target.value)} />
        <input placeholder="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
        <input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr repeat(4, 0.8fr) 0.9fr", gap: "0.75rem", padding: "0.6rem 0.75rem", background: "var(--surface-2)", fontSize: "0.72rem", textTransform: "uppercase", color: "var(--text-muted)" }}>
          <span>Invoice</span><span>Bill</span><span>Paid</span><span>CN Adj.</span><span>Outstanding</span><span>Allocate</span>
        </div>
        {bills.filter((bill) => bill.outstanding > 0.01).map((bill) => (
          <div key={bill.id} style={{ display: "grid", gridTemplateColumns: "1.1fr repeat(4, 0.8fr) 0.9fr", gap: "0.75rem", padding: "0.6rem 0.75rem", borderTop: "1px solid var(--border)", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: "monospace", fontWeight: 700 }}>{bill.invoiceNo ?? "No Invoice"}</div>
              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{fmtDate(bill.invoiceDate ?? bill.createdAt)}</div>
            </div>
            <span>{fmt(bill.billAmount)}</span>
            <span>{bill.paidAmount > 0 ? fmt(bill.paidAmount) : "-"}</span>
            <span>{bill.creditNoteAdjusted > 0 ? fmt(bill.creditNoteAdjusted) : "-"}</span>
            <span>{fmt(bill.outstanding)}</span>
            <input type="number" min="0" step="0.01" value={allocs[bill.id] ?? ""} onChange={(e) => setAllocs((current) => ({ ...current, [bill.id]: e.target.value }))} />
          </div>
        ))}
      </div>
      <div><button onClick={submit} disabled={saving} className="btn btn-primary">{saving ? "Saving..." : "Record Payment"}</button></div>
    </div>
  );
}

export default function PartyLedgerOverlay({ partyId, partyName, onClose }: { partyId: string; partyName: string; onClose: () => void }) {
  const [tab, setTab] = useState<"ledger" | "payment" | "creditNote">("ledger");
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    const res = await fetch(`/api/parties/${partyId}/ledger`);
    const json = await res.json();
    if (!res.ok) {
      setErr(json?.error || "Failed to load ledger");
      setLoading(false);
      return;
    }
    setData(json);
    setLoading(false);
  }

  useEffect(() => { load(); }, [partyId]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", display: "flex" }}>
      <div style={{ flex: 1 }} onClick={onClose} />
      <div style={{ width: "min(1160px, 96vw)", background: "var(--surface-1)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "1.1rem 1.5rem 0", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--surface-1)", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "0.75rem" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>{partyName}</h2>
              {data && <div style={{ marginTop: "0.25rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>{[data.party.gstNumber, data.party.phone, data.party.address].filter(Boolean).join(" · ")}</div>}
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.5rem", cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>
          {data && (
            <div style={{ display: "flex", gap: "1.4rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
              {[
                { label: "Purchases", value: fmt(data.summary.totalCredit), color: "#93c5fd" },
                { label: "Payments + CN", value: fmt(data.summary.totalDebit), color: "#fca5a5" },
                { label: "Credit Notes", value: fmt(data.summary.totalCreditNotes), color: "#fb923c" },
                { label: "Balance", value: `${fmt(Math.abs(data.summary.closingBalance))} ${data.summary.balanceType}`, color: "#fcd34d" },
                { label: "Bills", value: `${data.summary.billCount}`, color: "var(--text-secondary)" },
                { label: "Payments", value: `${data.summary.paymentCount}`, color: "var(--text-secondary)" },
                { label: "CN Count", value: `${data.summary.creditNoteCount}`, color: "var(--text-secondary)" },
              ].map((chip) => (
                <div key={chip.label} style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{chip.label}</span>
                  <span style={{ fontSize: "0.88rem", fontWeight: 700, color: chip.color, fontFamily: "monospace" }}>{chip.value}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 0, borderTop: "1px solid var(--border)" }}>
            {(["ledger", "payment", "creditNote"] as const).map((value) => (
              <button key={value} onClick={() => setTab(value)} style={{ padding: "0.6rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, background: "none", border: "none", cursor: "pointer", borderBottom: tab === value ? "2px solid #6366f1" : "2px solid transparent", color: tab === value ? "#818cf8" : "var(--text-muted)" }}>
                {value === "ledger" ? "Ledger" : value === "payment" ? "Payment Entry" : "Credit Note"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {loading ? (
            <div style={{ padding: "2rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>{[1, 2, 3].map((item) => <div key={item} className="skeleton" style={{ height: 44, borderRadius: 8 }} />)}</div>
          ) : err ? (
            <div className="alert alert-error" style={{ margin: "1.5rem" }}>{err}</div>
          ) : tab === "payment" ? (
            <PaymentEntryTab partyId={partyId} onAdded={() => { load(); setTab("ledger"); }} />
          ) : tab === "creditNote" ? (
            <CreditNoteEntryTab partyId={partyId} partyName={partyName} onAdded={() => { load(); setTab("ledger"); }} />
          ) : data ? (
            <div style={{ padding: "1.5rem" }}>
              <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "110px 120px 1.4fr 110px 120px 120px 130px", gap: "0.75rem", padding: "0.65rem 0.8rem", background: "var(--surface-2)", fontSize: "0.72rem", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  <span>Date</span><span>Vch No</span><span>Particulars</span><span>Type</span><span>Debit</span><span>Credit</span><span>Balance</span>
                </div>
                {data.entries.map((entry) => (
                  <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "110px 120px 1.4fr 110px 120px 120px 130px", gap: "0.75rem", padding: "0.7rem 0.8rem", borderTop: "1px solid var(--border)", alignItems: "start", background: entry.kind === "bill" ? "transparent" : entry.kind === "creditNote" ? "rgba(251,146,60,0.05)" : "rgba(52,211,153,0.04)" }}>
                    <span>{fmtDate(entry.date)}</span>
                    <span style={{ fontFamily: "monospace" }}>{entry.vchNo ?? "-"}</span>
                    <div>
                      <div style={{ color: entry.kind === "bill" ? "var(--text-primary)" : entry.kind === "creditNote" ? "#fb923c" : "#6ee7b7" }}>{entry.particulars}</div>
                      {entry.allocations && entry.allocations.length > 0 && (
                        <div style={{ marginTop: 4, fontSize: "0.74rem", color: "var(--text-muted)" }}>
                          {entry.allocations.map((allocation) => `${allocation.invoiceNo ?? "On Account"}: ${fmt(allocation.amount)}`).join(" · ")}
                        </div>
                      )}
                    </div>
                    <span>{entry.vchType}</span>
                    <span>{entry.debit != null ? fmt(entry.debit) : "-"}</span>
                    <span>{entry.credit != null ? fmt(entry.credit) : "-"}</span>
                    <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{fmt(Math.abs(entry.balance))} {entry.balanceType}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
