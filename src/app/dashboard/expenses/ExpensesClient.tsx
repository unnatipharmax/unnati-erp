"use client";
import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Category = "PERSONAL" | "STATIONARY" | "MONTHLY" | "YEARLY";

type Expense = {
  id: string;
  category: Category;
  description: string;
  amount: number;
  expenseDate: string;
  paymentMode: string | null;
  notes: string | null;
  createdAt: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const TABS: { key: Category; label: string; icon: string; color: string }[] = [
  { key: "PERSONAL",   label: "Personal",           icon: "👤", color: "#6366f1" },
  { key: "STATIONARY", label: "Company Stationary",  icon: "✏️", color: "#f59e0b" },
  { key: "MONTHLY",    label: "Month Expenses",      icon: "📅", color: "#10b981" },
  { key: "YEARLY",     label: "Yearly Expenses",     icon: "📆", color: "#3b82f6" },
];

const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque", "Other"];

function today() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtAmt(n: number) {
  return "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

// ── Add Expense Form ──────────────────────────────────────────────────────────
function AddExpenseForm({
  category,
  onAdded,
}: {
  category: Category;
  onAdded: () => void;
}) {
  const [form, setForm] = useState({
    description: "",
    amount: "",
    expenseDate: today(),
    paymentMode: "Cash",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim() || !form.amount) { setErr("Description and amount are required."); return; }
    setSaving(true); setErr("");
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, category, amount: parseFloat(form.amount) }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setErr(data.error ?? "Failed"); return; }
    setForm({ description: "", amount: "", expenseDate: today(), paymentMode: "Cash", notes: "" });
    onAdded();
  }

  const inp: React.CSSProperties = {
    padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)",
    background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "0.85rem", width: "100%", boxSizing: "border-box",
  };

  return (
    <form onSubmit={submit} style={{ background: "var(--surface-1)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
      <div style={{ fontWeight: 700, marginBottom: 14, fontSize: "0.9rem" }}>Add Expense</div>
      {err && <div style={{ color: "#f87171", marginBottom: 10, fontSize: "0.83rem" }}>{err}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Description *</label>
          <input style={inp} value={form.description} onChange={e => set("description", e.target.value)} placeholder="What was this expense for?" />
        </div>
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Amount (₹) *</label>
          <input style={inp} type="number" min="0" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Date</label>
          <input style={inp} type="date" value={form.expenseDate} onChange={e => set("expenseDate", e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Payment Mode</label>
          <select style={inp} value={form.paymentMode} onChange={e => set("paymentMode", e.target.value)}>
            {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "flex-end" }}>
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Notes (optional)</label>
          <input style={inp} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Additional notes..." />
        </div>
        <button
          type="submit"
          disabled={saving}
          style={{ padding: "7px 22px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 7, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {saving ? "Saving…" : "+ Add Expense"}
        </button>
      </div>
    </form>
  );
}

// ── Expense Row ───────────────────────────────────────────────────────────────
function ExpenseRow({ expense, onDeleted }: { expense: Expense; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);

  async function del() {
    if (!confirm("Delete this expense?")) return;
    setDeleting(true);
    await fetch(`/api/expenses/${expense.id}`, { method: "DELETE" });
    onDeleted();
  }

  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{ padding: "10px 12px", fontSize: "0.85rem" }}>{fmtDate(expense.expenseDate)}</td>
      <td style={{ padding: "10px 12px", fontSize: "0.85rem" }}>{expense.description}</td>
      <td style={{ padding: "10px 12px", fontSize: "0.85rem", textAlign: "right", fontWeight: 600 }}>
        {fmtAmt(expense.amount)}
      </td>
      <td style={{ padding: "10px 12px", fontSize: "0.82rem", color: "var(--text-muted)" }}>
        {expense.paymentMode ?? "—"}
      </td>
      <td style={{ padding: "10px 12px", fontSize: "0.82rem", color: "var(--text-muted)" }}>
        {expense.notes ?? "—"}
      </td>
      <td style={{ padding: "10px 12px", textAlign: "right" }}>
        <button
          onClick={del}
          disabled={deleting}
          style={{ background: "none", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: "0.78rem" }}
        >
          {deleting ? "…" : "Delete"}
        </button>
      </td>
    </tr>
  );
}

// ── Category Panel ────────────────────────────────────────────────────────────
function CategoryPanel({ tab }: { tab: typeof TABS[number] }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear]   = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | "">("");

  const load = useCallback(async () => {
    setLoading(true);
    let url = `/api/expenses?category=${tab.key}&year=${filterYear}`;
    if (filterMonth !== "") url += `&month=${filterMonth}`;
    const res = await fetch(url);
    const data = await res.json();
    setExpenses(data.expenses ?? []);
    setLoading(false);
  }, [tab.key, filterYear, filterMonth]);

  useEffect(() => { load(); }, [load]);

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { v: 1, l: "January" }, { v: 2, l: "February" }, { v: 3, l: "March" },
    { v: 4, l: "April" },   { v: 5, l: "May" },       { v: 6, l: "June" },
    { v: 7, l: "July" },    { v: 8, l: "August" },    { v: 9, l: "September" },
    { v: 10, l: "October" },{ v: 11, l: "November" }, { v: 12, l: "December" },
  ];

  const inp: React.CSSProperties = {
    padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)",
    background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "0.83rem",
  };

  return (
    <div>
      <AddExpenseForm category={tab.key} onAdded={load} />

      {/* Filters + Summary */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Year</label>
          <select style={inp} value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Month</label>
          <select style={inp} value={filterMonth} onChange={e => setFilterMonth(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">All months</option>
            {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: "8px 18px", textAlign: "center" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>ENTRIES</div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{expenses.length}</div>
          </div>
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: "8px 18px", textAlign: "center", borderLeft: `3px solid ${tab.color}` }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>TOTAL</div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem", color: tab.color }}>{fmtAmt(total)}</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "var(--surface-1)", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>
        ) : expenses.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            No expenses found. Add one above.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Date</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Description</th>
                <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>Amount</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Mode</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Notes</th>
                <th style={{ padding: "10px 12px" }}></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <ExpenseRow key={e.id} expense={e} onDeleted={load} />
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--surface-2)", fontWeight: 700 }}>
                <td colSpan={2} style={{ padding: "10px 12px", fontSize: "0.85rem" }}>Total</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontSize: "0.9rem", color: tab.color }}>
                  {fmtAmt(total)}
                </td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ExpensesClient() {
  const [active, setActive] = useState<Category>("PERSONAL");
  const activeTab = TABS.find(t => t.key === active)!;

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: "1.4rem", fontWeight: 700 }}>Expenses</h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            style={{
              padding: "10px 22px",
              borderRadius: 10,
              border: `2px solid ${active === tab.key ? tab.color : "var(--border)"}`,
              background: active === tab.key ? tab.color + "22" : "var(--surface-1)",
              color: active === tab.key ? tab.color : "var(--text-muted)",
              fontWeight: active === tab.key ? 700 : 400,
              fontSize: "0.88rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.15s",
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Active panel */}
      <div style={{ borderLeft: `4px solid ${activeTab.color}`, paddingLeft: 20 }}>
        <CategoryPanel key={active} tab={activeTab} />
      </div>
    </div>
  );
}
