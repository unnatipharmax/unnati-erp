"use client";
import { useState, useCallback } from "react";

const PAGE_SIZE = 9;

// ── Pagination controls ────────────────────────────────────────────────────────

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="px-2.5 py-1 rounded-md text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ←
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e-${i}`} className="px-1 text-xs text-slate-600">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              p === page
                ? "bg-slate-600 text-slate-100"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="px-2.5 py-1 rounded-md text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        →
      </button>
    </div>
  );
}

type Account = {
  id: string; name: string; balance: number;
  createdAt: string; orderCount: number; token: string | null;
};

type Order = {
  id: string; fullName: string; email?: string; phone?: string;
  status: string; createdAt: string;
  orderValue: number | null; brandName: string | null;
  quantity: number; shipmentMode: string | null; shippingPrice: number;
  inrAmount: number | null; dollarAmount: number | null;
  exchangeRate: number | null; grsNumber: string | null;
  paymentDepositDate: string | null;
};

// ── Shared helpers ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  INITIATED:        { bg: "bg-amber-500/10",  text: "text-amber-600" },
  SALES_UPDATED:    { bg: "bg-sky-500/10",    text: "text-sky-600"   },
  PAYMENT_VERIFIED: { bg: "bg-teal-500/10",   text: "text-teal-600"  },
  PACKING:          { bg: "bg-orange-500/10", text: "text-orange-600"},
  DISPATCHED:       { bg: "bg-teal-500/10",   text: "text-teal-600"  },
  COMPLETED:        { bg: "bg-slate-500/10",  text: "text-slate-500" },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: "bg-slate-500/10", text: "text-slate-500" };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ── Payment-edit row ───────────────────────────────────────────────────────────

function PaymentRow({
  order, onSaved,
}: { order: Order; onSaved: (updated: Partial<Order>) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState<string | null>(null);
  const [form, setForm] = useState({
    inrAmount:          order.inrAmount?.toString()          ?? "",
    dollarAmount:       order.dollarAmount?.toString()       ?? "",
    exchangeRate:       order.exchangeRate?.toString()       ?? "",
    grsNumber:          order.grsNumber                      ?? "",
    paymentDepositDate: order.paymentDepositDate             ?? "",
  });

  function set(k: string, v: string) {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === "inrAmount" || k === "dollarAmount") {
        const inr = parseFloat(k === "inrAmount" ? v : f.inrAmount);
        const usd = parseFloat(k === "dollarAmount" ? v : f.dollarAmount);
        if (inr > 0 && usd > 0) {
          next.exchangeRate = (inr / usd).toFixed(2);
        }
      }
      return next;
    });
  }

  async function save() {
    setSaving(true); setErr(null);
    const res = await fetch(`/api/orders/${order.id}/payment`, {
      method: "PATCH",
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
    setEditing(false); setSaving(false);
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
      <tr className={editing ? "bg-slate-800/40" : "hover:bg-slate-800/20 transition-colors"}>
        <td className="py-3 pl-4 pr-2">
          <div className="font-medium text-slate-200 text-sm">{order.fullName}</div>
          {order.email && (
            <div className="text-xs text-slate-500 mt-0.5">{order.email}</div>
          )}
        </td>
        <td className="py-3 px-2 text-xs text-slate-400 whitespace-nowrap">
          {new Date(order.createdAt).toLocaleDateString("en-IN")}
        </td>
        <td className="py-3 px-2"><StatusPill status={order.status} /></td>
        <td className="py-3 px-2 text-xs text-slate-400 max-w-[120px] truncate">
          {order.brandName ?? <span className="text-slate-600">—</span>}
        </td>
        <td className="py-3 px-2 text-right text-xs font-mono">
          {order.orderValue != null
            ? <span className="text-amber-600">₹{order.orderValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            : <span className="text-slate-600">—</span>}
        </td>
        <td className="py-3 px-2 text-right text-xs font-mono">
          {order.inrAmount != null
            ? <span className="text-teal-600">₹{order.inrAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            : <span className="text-slate-600">—</span>}
        </td>
        <td className="py-3 px-2 text-right text-xs font-mono">
          {order.dollarAmount != null
            ? <span className="text-sky-600">${order.dollarAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            : <span className="text-slate-600">—</span>}
        </td>
        <td className="py-3 px-2 text-xs text-slate-400 whitespace-nowrap">
          {order.paymentDepositDate ?? <span className="text-slate-600">—</span>}
        </td>
        <td className="py-3 px-2 text-xs text-slate-400 max-w-[120px] truncate">
          {order.grsNumber ?? <span className="text-slate-600">—</span>}
        </td>
        <td className="py-3 pl-2 pr-4">
          <div className="flex items-center gap-1.5 justify-end">
            {hasPayment && !editing && (
              <span className="text-teal-600 text-[10px] font-medium">✓</span>
            )}
            <button
              onClick={() => editing ? cancel() : setEditing(true)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                editing
                  ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  : hasPayment
                  ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {editing ? "Cancel" : hasPayment ? "Edit" : "Fill"}
            </button>
          </div>
        </td>
      </tr>

      {editing && (
        <tr className="bg-slate-800/30">
          <td colSpan={10} className="px-4 pb-4 pt-2">
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: "INR Amount (₹)", key: "inrAmount", placeholder: "0.00", mode: "decimal" as const },
                { label: "Dollar Amount ($)", key: "dollarAmount", placeholder: "0.00", mode: "decimal" as const },
                { label: "Payment Deposit Date", key: "paymentDepositDate", type: "date" },
                { label: "GRS Number", key: "grsNumber", placeholder: "GRS/..." },
              ].map(({ label, key, placeholder, mode, type }) => (
                <div key={key}>
                  <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
                  <input
                    type={type ?? "text"}
                    value={form[key as keyof typeof form]}
                    onChange={e => set(key, e.target.value)}
                    inputMode={mode}
                    placeholder={placeholder}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
              ))}
              {/* Exchange rate — auto-calculated from INR ÷ USD */}
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">
                  Exchange Rate <span className="text-slate-600">(auto)</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={form.exchangeRate}
                  placeholder="INR ÷ USD"
                  className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs text-teal-400 font-mono placeholder:text-slate-600 cursor-default focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={save}
                disabled={saving}
                className="px-3 py-1.5 rounded-md bg-slate-600 hover:bg-slate-500 text-xs font-medium text-slate-100 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={cancel}
                className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-400 transition-colors"
              >
                Cancel
              </button>
              {err && <span className="text-xs text-red-500">{err}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Orders table (shared between both tabs) ────────────────────────────────────

function OrdersTable({
  orders, onSaved,
}: { orders: Order[]; onSaved: (id: string, updated: Partial<Order>) => void }) {
  const [page, setPage] = useState(1);

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-600">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="mb-3 opacity-40">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <p className="text-sm">No orders found.</p>
      </div>
    );
  }

  const paged = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 text-xs text-slate-500">
        <span>{orders.length} order{orders.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[900px] text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/60">
              {["Customer", "Date", "Status", "Brand", "Order Value", "INR Amount", "Dollar Amount", "Pay Date", "GRS", ""].map((h, i) => (
                <th
                  key={i}
                  className={`py-2.5 px-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 whitespace-nowrap ${
                    i === 0 ? "pl-4" : i === 9 ? "pr-4" : ""
                  } ${[4,5,6].includes(i) ? "text-right" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {paged.map(o => (
              <PaymentRow
                key={o.id}
                order={o}
                onSaved={updated => onSaved(o.id, updated)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={orders.length} onChange={p => { setPage(p); }} />
    </div>
  );
}

// ── Multi-Order Tab ────────────────────────────────────────────────────────────

function MultiOrderTab({ accounts }: { accounts: Account[] }) {
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [orders,        setOrders]        = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [accountInfo,   setAccountInfo]   = useState<{ name: string; balance: number } | null>(null);
  const [accPage,       setAccPage]       = useState(1);

  const pagedAccounts = accounts.slice((accPage - 1) * PAGE_SIZE, accPage * PAGE_SIZE);

  async function selectAccount(id: string) {
    if (id === selectedId) return;
    setSelectedId(id); setLoadingOrders(true);
    const res  = await fetch(`/api/ledger/${id}`);
    const data = await res.json();
    setOrders(data.orders ?? []);
    setAccountInfo(data.account ?? null);
    setLoadingOrders(false);
  }

  const handleSaved = useCallback((orderId: string, updated: Partial<Order>) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updated } : o));
  }, []);

  return (
    <div className="flex gap-5">
      {/* Account sidebar */}
      <div className="w-56 flex-shrink-0">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2 px-1">
          Client Accounts
        </p>
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-600 px-1">No accounts found.</p>
        ) : (
          <>
            <div className="space-y-1">
              {pagedAccounts.map(a => (
                <button
                  key={a.id}
                  onClick={() => selectAccount(a.id)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                    a.id === selectedId
                      ? "bg-slate-700/60 border border-slate-600"
                      : "hover:bg-slate-800/60 border border-transparent"
                  }`}
                >
                  <div className="text-sm font-medium text-slate-200 truncate">{a.name}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-medium text-teal-600">
                      ₹{a.balance.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[10px] text-slate-600">·</span>
                    <span className="text-[10px] text-slate-500">
                      {a.orderCount} order{a.orderCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <Pagination page={accPage} total={accounts.length} onChange={p => { setAccPage(p); setSelectedId(null); }} />
          </>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0">
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-600 rounded-xl border border-slate-800/60">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="mb-3 opacity-40">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <p className="text-sm">Select an account to view orders</p>
          </div>
        ) : loadingOrders ? (
          <div className="space-y-2">
            {[1,2,3].map(i => (
              <div key={i} className="h-12 rounded-lg bg-slate-800/40 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Account header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-200">{accountInfo?.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Balance:{" "}
                  <span className="text-teal-600 font-medium">
                    ₹{accountInfo?.balance.toLocaleString("en-IN")}
                  </span>
                </p>
              </div>
              <a
                href={`/api/client-account-links/download/${selectedId}`}
                download
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Download Excel
              </a>
            </div>
            <OrdersTable orders={orders} onSaved={handleSaved} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Root Component ─────────────────────────────────────────────────────────────

export default function LedgerClient({ accounts }: { accounts: Account[] }) {
  const [tab, setTab] = useState<"multi" | "single" | "verified">("multi");

  const [singleOrders,  setSingleOrders]  = useState<Order[] | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleLoaded,  setSingleLoaded]  = useState(false);

  async function loadSingleOrders() {
    if (singleLoaded || singleLoading) return;
    setSingleLoading(true);
    const res  = await fetch("/api/ledger/single-orders");
    const data = await res.json();
    setSingleOrders(data.orders ?? []);
    setSingleLoading(false);
    setSingleLoaded(true);
  }

  function handleTabChange(key: "multi" | "single" | "verified") {
    setTab(key);
    if (key === "single" || key === "verified") loadSingleOrders();
  }

  const handleSingleSaved = useCallback((orderId: string, updated: Partial<Order>) => {
    setSingleOrders(prev => prev ? prev.map(o => o.id === orderId ? { ...o, ...updated } : o) : prev);
  }, []);

  const salesUpdatedOrders   = (singleOrders ?? []).filter(o => o.status === "SALES_UPDATED");
  const paymentVerifiedOrders = (singleOrders ?? []).filter(o => o.status === "PAYMENT_VERIFIED");

  const loadingView = (
    <div className="space-y-2">
      {[1,2,3,4].map(i => (
        <div key={i} className="h-12 rounded-lg bg-slate-800/40 animate-pulse" />
      ))}
    </div>
  );

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-800 pb-0">
        {([
          { key: "multi",    label: "Multi Order Accounts" },
          { key: "single",   label: "Single Orders" },
          { key: "verified", label: "Payment Verified" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key
                ? "border-slate-400 text-slate-200"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {label}
            {key === "single"   && singleLoaded && salesUpdatedOrders.length   > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500">
                {salesUpdatedOrders.length}
              </span>
            )}
            {key === "verified" && singleLoaded && paymentVerifiedOrders.length > 0 && (
              <span className="ml-1.5 rounded-full bg-teal-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-teal-500">
                {paymentVerifiedOrders.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "multi" && <MultiOrderTab accounts={accounts} />}

      {tab === "single" && (
        singleLoading || !singleOrders
          ? loadingView
          : salesUpdatedOrders.length === 0
          ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="mb-3 opacity-40">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <p className="text-sm">No pending single orders.</p>
              <p className="text-xs mt-1 text-slate-600">Orders with Sales Updated status appear here.</p>
            </div>
          )
          : <OrdersTable orders={salesUpdatedOrders} onSaved={handleSingleSaved} />
      )}

      {tab === "verified" && (
        singleLoading || !singleOrders
          ? loadingView
          : paymentVerifiedOrders.length === 0
          ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="mb-3 opacity-40">
                <circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/>
              </svg>
              <p className="text-sm">No payment verified orders yet.</p>
            </div>
          )
          : <OrdersTable orders={paymentVerifiedOrders} onSaved={handleSingleSaved} />
      )}
    </div>
  );
}
