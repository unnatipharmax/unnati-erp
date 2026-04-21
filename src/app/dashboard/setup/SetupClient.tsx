"use client";
import { useState, useMemo, useEffect } from "react";

type Role = "ADMIN" | "MANAGER" | "SALES" | "ACCOUNTS" | "PACKAGING";

type User = {
  id: string; username: string; email: string; name: string;
  role: Role; isActive: boolean; createdAt: string;
};

const ROLES: Role[] = ["ADMIN", "MANAGER", "SALES", "ACCOUNTS", "PACKAGING"];

const ROLE_BADGE: Record<Role, string> = {
  ADMIN:     "badge-blue",
  MANAGER:   "badge-amber",
  SALES:     "badge-green",
  ACCOUNTS:  "badge-gray",
  PACKAGING: "badge-gray",
};

const ROLE_DESC: Record<Role, string> = {
  ADMIN:     "Full access to everything",
  MANAGER:   "View all + approve orders",
  SALES:     "Order initiation + entry",
  ACCOUNTS:  "Ledger + billing",
  PACKAGING: "View orders only",
};

// ── Add User Modal ────────────────────────────────────────────────────────────
function AddUserModal({ onClose, onAdded }: { onClose: () => void; onAdded: (u: User) => void }) {
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", role: "SALES" as Role });
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); if (err) setErr(null); }

  async function handleSave() {
    if (!form.name || !form.username || !form.email || !form.password)
      { setErr("All fields are required"); return; }
    setLoading(true); setErr(null);
    const res  = await fetch("/api/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data?.error || "Failed"); setLoading(false); }
    else onAdded({ ...data, createdAt: data.createdAt || new Date().toISOString() });
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M19 8v6M22 11h-6" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Add New User</h3>
              <p style={{ margin: 0, fontSize: "0.75rem" }}>Assign role and credentials</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {[["name","Full Name","e.g. Aksh Kumar"],["username","Username","e.g. aksh123"],["email","Email","aksh@unnati.com"],["password","Password","Min 6 characters"]].map(([k, label, ph]) => (
              <div key={k}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{label}</label>
                <input
                  value={(form as any)[k]}
                  onChange={e => set(k, e.target.value)}
                  placeholder={ph}
                  type={k === "password" ? "password" : "text"}
                  autoComplete={k === "password" ? "new-password" : undefined}
                />
              </div>
            ))}
          </div>

          {/* Role selector */}
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>Role</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              {ROLES.map(r => (
                <button
                  key={r} type="button"
                  onClick={() => set("role", r)}
                  style={{
                    padding: "0.625rem 0.75rem",
                    borderRadius: 10,
                    border: `1px solid ${form.role === r ? "rgba(59,130,246,0.5)" : "var(--border)"}`,
                    background: form.role === r ? "rgba(59,130,246,0.12)" : "var(--surface-2)",
                    cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: form.role === r ? "#93c5fd" : "var(--text-primary)" }}>{r}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>{ROLE_DESC[r]}</div>
                </button>
              ))}
            </div>
          </div>

          {err && (
            <div className="alert alert-error">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
              </svg>
              {err}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={handleSave} disabled={loading} className="btn btn-primary" style={{ flex: 1 }}>
            {loading ? "Adding…" : "Add User"}
          </button>
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
// ── Company Settings Panel ─────────────────────────────────────────────────────
type CS = {
  name: string; address: string; email: string; phone: string;
  website: string; indiamart: string; marketing: string;
  gstin: string; iec: string; drugLic: string;
  bankName: string; bankAccount: string; bankIfsc: string; bankBranch: string; bankSwift: string;
};

const CS_EMPTY: CS = {
  name: "", address: "", email: "", phone: "",
  website: "", indiamart: "", marketing: "",
  gstin: "", iec: "", drugLic: "",
  bankName: "", bankAccount: "", bankIfsc: "", bankBranch: "", bankSwift: "",
};

function CompanySettingsPanel() {
  const [form, setForm]     = useState<CS>(CS_EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings/company")
      .then(r => r.json())
      .then(d => { setForm({ ...CS_EMPTY, ...d }); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function set(k: keyof CS, v: string) {
    setForm(f => ({ ...f, [k]: v }));
    if (msg) setMsg(null);
  }

  async function handleSave() {
    setSaving(true); setMsg(null);
    const res = await fetch("/api/settings/company", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) { setForm({ ...CS_EMPTY, ...data }); setMsg({ ok: true, text: "Company settings saved successfully." }); }
    else setMsg({ ok: false, text: data?.error || "Failed to save." });
  }

  const iS: React.CSSProperties = { width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "0.85rem", boxSizing: "border-box" };
  const lS: React.CSSProperties = { fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4, display: "block" };
  const sH: React.CSSProperties = { fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase" as const, color: "var(--accent)", marginBottom: 10, letterSpacing: 0.5, marginTop: 18 };

  if (loading) return <div style={{ color: "var(--text-muted)", padding: 16 }}>Loading…</div>;

  return (
    <div className="card" style={{ marginBottom: "1.5rem" }}>
      <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>🏢 Company Settings</div>
      <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: 18 }}>
        These details appear on Quotations and other documents. Only admins can edit.
      </div>

      {/* ── Basic Info ── */}
      <div style={sH}>Basic Information</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
        <div>
          <label style={lS}>Company Name</label>
          <input style={iS} value={form.name} onChange={e => set("name", e.target.value)} />
        </div>
        <div>
          <label style={lS}>Email</label>
          <input style={iS} value={form.email} onChange={e => set("email", e.target.value)} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lS}>Registered Address</label>
          <textarea style={{ ...iS, minHeight: 60, resize: "vertical" }} value={form.address} onChange={e => set("address", e.target.value)} />
        </div>
        <div>
          <label style={lS}>Phone</label>
          <input style={iS} value={form.phone} onChange={e => set("phone", e.target.value)} />
        </div>
      </div>

      {/* ── Websites ── */}
      <div style={sH}>Websites</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 20px" }}>
        <div>
          <label style={lS}>Personal Website</label>
          <input style={iS} value={form.website} onChange={e => set("website", e.target.value)} placeholder="www.unnatipharma.com" />
        </div>
        <div>
          <label style={lS}>IndiaMart Website</label>
          <input style={iS} value={form.indiamart} onChange={e => set("indiamart", e.target.value)} placeholder="www.medshopy.com" />
        </div>
        <div>
          <label style={lS}>Marketing Website</label>
          <input style={iS} value={form.marketing} onChange={e => set("marketing", e.target.value)} placeholder="medindiadropshipper.com" />
        </div>
      </div>

      {/* ── Legal / Compliance ── */}
      <div style={sH}>Legal &amp; Compliance</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 20px" }}>
        <div>
          <label style={lS}>GSTIN</label>
          <input style={{ ...iS, fontFamily: "monospace" }} value={form.gstin} onChange={e => set("gstin", e.target.value)} />
        </div>
        <div>
          <label style={lS}>IEC Code</label>
          <input style={{ ...iS, fontFamily: "monospace" }} value={form.iec} onChange={e => set("iec", e.target.value)} />
        </div>
        <div>
          <label style={lS}>Drug License No.</label>
          <input style={{ ...iS, fontFamily: "monospace" }} value={form.drugLic} onChange={e => set("drugLic", e.target.value)} />
        </div>
      </div>

      {/* ── Bank Details ── */}
      <div style={sH}>Bank Details (auto-filled in Quotations)</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 20px" }}>
        <div>
          <label style={lS}>Bank Name</label>
          <input style={iS} value={form.bankName} onChange={e => set("bankName", e.target.value)} />
        </div>
        <div>
          <label style={lS}>Account Number</label>
          <input style={{ ...iS, fontFamily: "monospace" }} value={form.bankAccount} onChange={e => set("bankAccount", e.target.value)} />
        </div>
        <div>
          <label style={lS}>IFSC Code</label>
          <input style={{ ...iS, fontFamily: "monospace" }} value={form.bankIfsc} onChange={e => set("bankIfsc", e.target.value)} />
        </div>
        <div>
          <label style={lS}>Branch</label>
          <input style={iS} value={form.bankBranch} onChange={e => set("bankBranch", e.target.value)} />
        </div>
        <div>
          <label style={lS}>SWIFT / BIC</label>
          <input style={{ ...iS, fontFamily: "monospace" }} value={form.bankSwift} onChange={e => set("bankSwift", e.target.value)} />
        </div>
      </div>

      {/* ── Actions ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
          style={{ minWidth: 140 }}
        >
          {saving ? "Saving…" : "💾 Save Settings"}
        </button>
        {msg && (
          <span style={{ fontSize: "0.85rem", color: msg.ok ? "#10b981" : "#ef4444", fontWeight: 600 }}>
            {msg.ok ? "✓ " : "✗ "}{msg.text}
          </span>
        )}
      </div>
    </div>
  );
}

export default function SetupClient({ initialUsers, currentUserId }: { initialUsers: User[]; currentUserId: string }) {
  const [users, setUsers]     = useState<User[]>(initialUsers);
  const [showModal, setShowModal] = useState(false);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [togglingId, setTogglingId]     = useState<string | null>(null);

  function handleAdded(u: User) { setUsers(prev => [u, ...prev]); setShowModal(false); }

  async function changeRole(id: string, role: Role) {
    setUpdatingRole(id);
    const res  = await fetch(`/api/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (res.ok) setUsers(prev => prev.map(u => u.id === id ? { ...u, role: data.role } : u));
    setUpdatingRole(null);
  }

  async function toggleActive(id: string, current: boolean) {
    setTogglingId(id);
    const res  = await fetch(`/api/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    const data = await res.json();
    if (res.ok) setUsers(prev => prev.map(u => u.id === id ? { ...u, isActive: data.isActive } : u));
    setTogglingId(null);
  }

  const stats = useMemo(() => ({
    total:  users.length,
    active: users.filter(u => u.isActive).length,
    byRole: ROLES.reduce((acc, r) => ({ ...acc, [r]: users.filter(u => u.role === r).length }), {} as Record<Role, number>),
  }), [users]);

  return (
    <>
      {showModal && <AddUserModal onClose={() => setShowModal(false)} onAdded={handleAdded} />}

      {/* ── Company Settings ── */}
      <CompanySettingsPanel />

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Total Users",   value: stats.total,  color: "var(--text-primary)" },
          { label: "Active",        value: stats.active, color: "#10b981" },
          ...ROLES.map(r => ({ label: r, value: stats.byRole[r], color: "var(--text-secondary)" })),
        ].map(s => (
          <div key={s.label} className="card card-sm" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
          </svg>
          Add User
        </button>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Added On</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.5 }}>
                <td style={{ fontWeight: 600 }}>
                  {u.name}
                  {u.id === currentUserId && (
                    <span className="badge badge-blue" style={{ marginLeft: 8, fontSize: "0.65rem" }}>You</span>
                  )}
                </td>
                <td style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>@{u.username}</td>
                <td style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>{u.email}</td>
                <td>
                  {updatingRole === u.id ? (
                    <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>Updating…</span>
                  ) : (
                    <select
                      value={u.role}
                      onChange={e => changeRole(u.id, e.target.value as Role)}
                      disabled={u.id === currentUserId}
                      style={{ width: "auto", padding: "0.25rem 0.5rem", fontSize: "0.8125rem" }}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                </td>
                <td>
                  <span className={`badge ${u.isActive ? "badge-green" : "badge-gray"}`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                  {new Date(u.createdAt).toLocaleDateString("en-IN")}
                </td>
                <td>
                  {u.id !== currentUserId && (
                    <button
                      onClick={() => toggleActive(u.id, u.isActive)}
                      disabled={togglingId === u.id}
                      className={`btn btn-sm ${u.isActive ? "btn-danger" : "btn-secondary"}`}
                    >
                      {togglingId === u.id ? "…" : u.isActive ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}