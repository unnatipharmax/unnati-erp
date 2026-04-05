"use client";
import { useState, useEffect, useCallback } from "react";

type Reminder = {
  id:                 string;
  invoiceNo:          string | null;
  fullName:           string;
  email:              string;
  country:            string;
  dosagePerDay:       number | null;
  totalDosages:       number | null;
  daysSupply:         number | null;
  dosageStartDate:    string | null;
  dosageReminderDate: string;
  dosageReminderSent: boolean;
  hasPrescription:    boolean;
  daysUntil:          number;
  status:             "sent" | "overdue" | "due_soon" | "upcoming";
  products:           string;
};

const STATUS_STYLE: Record<Reminder["status"], { label: string; color: string; bg: string }> = {
  sent:     { label: "Sent",      color: "#6ee7b7", bg: "rgba(110,231,183,0.12)" },
  overdue:  { label: "Overdue",   color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  due_soon: { label: "Due Soon",  color: "#fcd34d", bg: "rgba(252,211,77,0.12)"  },
  upcoming: { label: "Upcoming",  color: "#93c5fd", bg: "rgba(147,197,253,0.12)" },
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DosageRemindersClient() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const [result,    setResult]    = useState("");
  const [err,       setErr]       = useState("");
  const [filter,    setFilter]    = useState<"all" | Reminder["status"]>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch("/api/dosage-reminders");
    const data = await res.json();
    setReminders(data.reminders ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  async function sendDue() {
    setSending(true); setResult(""); setErr("");
    const res  = await fetch("/api/dosage-reminders", { method: "POST" });
    const data = await res.json();
    setSending(false);
    if (!res.ok) { setErr(data?.error || "Failed"); return; }
    setResult(`Sent ${data.sent} reminder${data.sent !== 1 ? "s" : ""}.`);
    load();
  }

  const filtered = filter === "all" ? reminders : reminders.filter(r => r.status === filter);

  const counts = {
    overdue:  reminders.filter(r => r.status === "overdue").length,
    due_soon: reminders.filter(r => r.status === "due_soon").length,
    upcoming: reminders.filter(r => r.status === "upcoming").length,
    sent:     reminders.filter(r => r.status === "sent").length,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1>Dosage Reminders</h1>
          <p style={{ marginTop: "0.25rem", color: "var(--text-secondary)" }}>
            Automatic refill reminders for prescription orders
          </p>
        </div>
        <button onClick={sendDue} disabled={sending} className="btn btn-primary">
          {sending ? "Sending…" : "📧 Send Due Reminders Now"}
        </button>
      </div>

      {err    && <div className="alert alert-error"   style={{ marginBottom: "1rem" }}>{err}</div>}
      {result && <div className="alert alert-success" style={{ marginBottom: "1rem" }}>{result}</div>}

      {/* Summary chips + filter */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {([["all", "All", reminders.length, "var(--text-secondary)"], ["overdue", "Overdue", counts.overdue, "#f87171"], ["due_soon", "Due Soon", counts.due_soon, "#fcd34d"], ["upcoming", "Upcoming", counts.upcoming, "#93c5fd"], ["sent", "Sent", counts.sent, "#6ee7b7"]] as const).map(([key, label, count, color]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: "4px 12px", borderRadius: 20, fontSize: "0.78rem", fontWeight: 600,
              cursor: "pointer", border: "1px solid",
              background: filter === key ? `${color}20` : "var(--surface-2)",
              color:      filter === key ? color : "var(--text-muted)",
              borderColor: filter === key ? color : "var(--border)",
            }}
          >
            {label} <span style={{ fontFamily: "monospace", marginLeft: 4 }}>{count}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem", opacity: 0.4 }}>💊</div>
          <div style={{ fontWeight: 600 }}>No reminders in this category</div>
          <div style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
            Set dosage info on invoices via Edit Invoices → Dosage Reminder tab.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {filtered.map(r => {
            const ss = STATUS_STYLE[r.status];
            return (
              <div key={r.id} className="card" style={{ padding: "0.875rem 1rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                      {r.invoiceNo && (
                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.9rem", color: "#818cf8" }}>{r.invoiceNo}</span>
                      )}
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "2px 7px", borderRadius: 4, background: ss.bg, color: ss.color }}>
                        {ss.label}
                        {!r.dosageReminderSent && r.daysUntil > 0 && ` (${r.daysUntil}d)`}
                        {!r.dosageReminderSent && r.daysUntil <= 0 && ` (${Math.abs(r.daysUntil)}d ago)`}
                      </span>
                      {r.hasPrescription && (
                        <span style={{ fontSize: "0.65rem", color: "#818cf8", background: "rgba(99,102,241,0.1)", padding: "2px 6px", borderRadius: 4 }}>📋 Rx</span>
                      )}
                    </div>

                    <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.25rem" }}>{r.fullName}</div>

                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                      <span>✉ {r.email}</span>
                      <span>📍 {r.country}</span>
                      {r.products && <span style={{ color: "var(--text-muted)" }}>💊 {r.products}</span>}
                    </div>

                    <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", fontSize: "0.75rem", marginTop: "0.375rem", color: "var(--text-muted)" }}>
                      {r.totalDosages && <span><strong style={{ color: "var(--text-primary)" }}>{r.totalDosages}</strong> dosages</span>}
                      {r.dosagePerDay && <span><strong style={{ color: "var(--text-primary)" }}>{r.dosagePerDay}</strong>/day</span>}
                      {r.daysSupply    && <span><strong style={{ color: "#818cf8" }}>{r.daysSupply}</strong> day supply</span>}
                      {r.dosageStartDate && <span>Started: <strong>{fmtDate(r.dosageStartDate)}</strong></span>}
                      <span>Reminder: <strong style={{ color: ss.color }}>{fmtDate(r.dosageReminderDate)}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
