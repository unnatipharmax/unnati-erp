"use client";
import { useState, useCallback } from "react";

type Account = {
  id: string; name: string; balance: number;
  createdAt: string; orderCount: number; token: string | null;
};

type Order = {
  id: string; fullName: string; status: string; createdAt: string;
  orderValue: number | null; brandName: string | null;
  quantity: number; shipmentMode: string | null; shippingPrice: number;
  inrAmount: number | null; dollarAmount: number | null;
  exchangeRate: number | null; grsNumber: string | null;
  paymentDepositDate: string | null;
};

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    INITIATED:        "badge-gray",
    SALES_UPDATED:    "badge-blue",
    PAYMENT_VERIFIED: "badge-green",
    PACKING:          "badge-amber",
    DISPATCHED:       "badge-green",
  };
  return <span className={`badge ${map[status] ?? "badge-gray"}`}>{status.replace("_", " ")}</span>;
}

// ── Inline editable payment row ───────────────────────────────────────────────
function PaymentRow({ order, onSaved }: { order: Order; onSaved: (updated: Partial<Order>) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState<string | null>(null);
  const [form, setForm]       = useState({
    inrAmount:          order.inrAmount?.toString()          ?? "",
    dollarAmount:       order.dollarAmount?.toString()       ?? "",
    exchangeRate:       order.exchangeRate?.toString()       ?? "",
    grsNumber:          order.grsNumber                      ?? "",
    paymentDepositDate: order.paymentDepositDate             ?? "",
  });

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function save() {
    setSaving(true); setErr(null);
    const res = await fetch(`/api/orders/${order.id}/payment`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inrAmount:          form.inrAmount          || null,
        dollarAmount:       form.dollarAmount       || null,
        exchangeRate:       form.exchangeRate       || null,
        grsNumber:          form.grsNumber          || null,
        paymentDepositDate: form.paymentDepositDate || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data?.error || "Save failed"); setSaving(false); return; }
    onSaved(data);
    setEditing(false);
    setSaving(false);
  }

  function cancel() {
    setForm({
      inrAmount:          order.inrAmount?.toString()          ?? "",
      dollarAmount:       order.dollarAmount?.toString()       ?? "",
      exchangeRate:       order.exchangeRate?.toString()       ?? "",
      grsNumber:          order.grsNumber                      ?? "",
      paymentDepositDate: order.paymentDepositDate             ?? "",
    });
    setEditing(false); setErr(null);
  }

  const hasPayment = order.inrAmount || order.dollarAmount || order.grsNumber || order.paymentDepositDate;

  return (
    <>
      {/* Main row */}
      <tr style={{ borderBottom: editing ? "none" : undefined }}>
        <td style={{ fontWeight: 600 }}>{order.fullName}</td>
        <td style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
          {new Date(order.createdAt).toLocaleDateString("en-IN")}
        </td>
        <td><StatusBadge status={order.status} /></td>
        <td style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>
          {order.brandName ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
        </td>
        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {order.orderValue != null
            ? <span className="badge badge-amber">₹{order.orderValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            : <span style={{ color: "var(--text-muted)" }}>—</span>}
        </td>
        {/* Payment fields — display mode */}
        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {order.inrAmount != null
            ? <span style={{ color: "#6ee7b7" }}>₹{order.inrAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            : <span style={{ color: "var(--text-muted)" }}>—</span>}
        </td>
        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {order.dollarAmount != null
            ? <span style={{ color: "#93c5fd" }}>${order.dollarAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            : <span style={{ color: "var(--text-muted)" }}>—</span>}
        </td>
        <td style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>
          {order.paymentDepositDate ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
        </td>
        <td style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {order.grsNumber ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
        </td>
        <td>
          <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
            {hasPayment && !editing && (
              <span className="badge badge-green" style={{ fontSize: "0.65rem" }}>✓ Filled</span>
            )}
            <button
              onClick={() => setEditing(e => !e)}
              className={`btn btn-sm ${editing ? "btn-secondary" : "btn-primary"}`}
            >
              {editing ? "Cancel" : hasPayment ? "Edit" : "Fill"}
            </button>
          </div>
        </td>
      </tr>

      {/* Inline edit row */}
      {editing && (
        <tr style={{ background: "rgba(59,130,246,0.04)", borderTop: "1px solid rgba(59,130,246,0.15)" }}>
          <td colSpan={10} style={{ padding: "1rem 1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: "0.75rem", alignItems: "end" }}>
              {/* INR Amount */}
              <div>
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  INR Amount (₹)
                </label>
                <input
                  autoFocus
                  value={form.inrAmount}
                  onChange={e => set("inrAmount", e.target.value)}
                  inputMode="decimal" placeholder="0.00"
                  style={{ padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
                />
              </div>
              {/* Dollar Amount */}
              <div>
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  Dollar Amount ($)
                </label>
                <input
                  value={form.dollarAmount}
                  onChange={e => set("dollarAmount", e.target.value)}
                  inputMode="decimal" placeholder="0.00"
                  style={{ padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
                />
              </div>
              {/* Exchange Rate */}
              <div>
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  Exchange Rate
                </label>
                <input
                  value={form.exchangeRate}
                  onChange={e => set("exchangeRate", e.target.value)}
                  inputMode="decimal" placeholder="84.00"
                  style={{ padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
                />
              </div>
              {/* Payment Date */}
              <div>
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  Payment Deposit Date
                </label>
                <input
                  type="date"
                  value={form.paymentDepositDate}
                  onChange={e => set("paymentDepositDate", e.target.value)}
                  style={{ padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
                />
              </div>
              {/* GRS Number */}
              <div>
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  GRS Number
                </label>
                <input
                  value={form.grsNumber}
                  onChange={e => set("grsNumber", e.target.value)}
                  placeholder="GRS/..."
                  style={{ padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
                />
              </div>
            </div>

            {/* Error + Save */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.75rem" }}>
              <button onClick={save} disabled={saving} className="btn btn-primary btn-sm">
                {saving ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="animate-spin">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    Saving…
                  </span>
                ) : "Save Payment Details"}
              </button>
              <button onClick={cancel} className="btn btn-secondary btn-sm">Cancel</button>
              {err && (
                <div className="alert alert-error" style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}>
                  {err}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Account picker ────────────────────────────────────────────────────────────
function AccountCard({
  account, selected, onClick,
}: { account: Account; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="card card-sm"
      style={{
        cursor: "pointer",
        borderColor: selected ? "rgba(59,130,246,0.5)" : undefined,
        background:  selected ? "rgba(59,130,246,0.06)" : undefined,
        transition:  "all 0.15s",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>{account.name}</div>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.375rem", flexWrap: "wrap" }}>
        <span className="badge badge-green" style={{ fontSize: "0.7rem" }}>
          ₹{account.balance.toLocaleString("en-IN")}
        </span>
        <span className="badge badge-gray" style={{ fontSize: "0.7rem" }}>
          {account.orderCount} order{account.orderCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LedgerClient({ accounts }: { accounts: Account[] }) {
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [orders,     setOrders]         = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [accountInfo, setAccountInfo]   = useState<{ name: string; balance: number } | null>(null);

  async function selectAccount(id: string) {
    if (id === selectedId) return;
    setSelectedId(id);
    setLoadingOrders(true);
    const res  = await fetch(`/api/ledger/${id}`);
    const data = await res.json();
    setOrders(data.orders ?? []);
    setAccountInfo(data.account ?? null);
    setLoadingOrders(false);
  }

  const handleSaved = useCallback((orderId: string, updated: Partial<Order>) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updated } : o));
  }, []);

  const filled   = orders.filter(o => o.inrAmount || o.dollarAmount || o.grsNumber || o.paymentDepositDate).length;
  const unfilled = orders.length - filled;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem", alignItems: "start" }}>

      {/* Left — Account list */}
      <div>
        <h4 style={{ marginBottom: "0.75rem" }}>Client Accounts</h4>
        {accounts.length === 0 ? (
          <div className="card" style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
            No accounts found
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {accounts.map(a => (
              <AccountCard
                key={a.id}
                account={a}
                selected={a.id === selectedId}
                onClick={() => selectAccount(a.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right — Orders table */}
      <div>
        {!selectedId ? (
          <div className="card" style={{ textAlign: "center", padding: "4rem 2rem", color: "var(--text-muted)" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ margin: "0 auto 1rem", display: "block", opacity: 0.3 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            Select a client account to view and fill payment details
          </div>
        ) : loadingOrders ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 12 }} />)}
          </div>
        ) : (
          <>
            {/* Account header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <h2 style={{ margin: 0 }}>{accountInfo?.name}</h2>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem" }}>
                  Balance: <strong style={{ color: "#6ee7b7" }}>₹{accountInfo?.balance.toLocaleString("en-IN")}</strong>
                  {" · "}
                  <span style={{ color: "#6ee7b7" }}>{filled} filled</span>
                  {unfilled > 0 && <span style={{ color: "#fcd34d" }}> · {unfilled} pending</span>}
                </p>
              </div>
              <a
                href={`/api/client-account-links/download/${selectedId}`}
                download
                className="btn-download"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Download Excel
              </a>
            </div>

            {orders.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                No orders yet for this account.
              </div>
            ) : (
              <div className="table-wrapper" style={{ overflowX: "auto" }}>
                <table style={{ minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Brand</th>
                      <th style={{ textAlign: "right" }}>Order Value</th>
                      <th style={{ textAlign: "right" }}>INR Amount</th>
                      <th style={{ textAlign: "right" }}>Dollar Amount</th>
                      <th>Payment Date</th>
                      <th>GRS Number</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <PaymentRow
                        key={o.id}
                        order={o}
                        onSaved={updated => handleSaved(o.id, updated)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}