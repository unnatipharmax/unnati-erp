"use client";
import { useState, useMemo } from "react";

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