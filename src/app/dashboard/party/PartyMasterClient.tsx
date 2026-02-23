"use client";
import { useState, useEffect } from "react";

type Party = {
  id: string;
  name: string;
  address: string | null;
  gstNumber: string | null;
  drugLicenseNumber: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  phones: { id: string; phone: string }[];
  emails: { id: string; email: string }[];
  _count?: { PurchaseBills: number };
};

const EMPTY = {
  name: "", address: "", gstNumber: "",
  drugLicenseNumber: "", notes: "",
  phone: "", email: "",
};

export default function PartyMasterClient() {
  const [parties,  setParties]  = useState<Party[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [modal,    setModal]    = useState<"add" | "edit" | null>(null);
  const [editing,  setEditing]  = useState<Party | null>(null);
  const [form,     setForm]     = useState({ ...EMPTY });
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res  = await fetch("/api/parties");
    const data = await res.json();
    setParties(data.parties ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function openAdd() {
    setForm({ ...EMPTY }); setEditing(null); setErr(""); setModal("add");
  }

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
          {search ? "No parties match your search." : "No parties yet. Add one or scan a purchase bill — parties are saved automatically."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {filtered.map(p => (
            <div key={p.id} className="card" style={{ padding: "0.875rem 1rem" }}>
              {/* Main row */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{p.name}</span>
                    {p._count?.PurchaseBills
                      ? <span className="badge badge-blue" style={{ fontSize: "0.65rem" }}>{p._count.PurchaseBills} bills</span>
                      : <span className="badge badge-gray" style={{ fontSize: "0.65rem" }}>No bills</span>}
                    {!p.isActive && <span className="badge" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", fontSize: "0.65rem" }}>Inactive</span>}
                  </div>

                  {/* Key details inline */}
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
                    {p.phones[0] && (
                      <span>📞 {p.phones[0].phone}</span>
                    )}
                    {p.emails[0] && (
                      <span>✉ {p.emails[0].email}</span>
                    )}
                    {p.address && (
                      <span style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        📍 {p.address}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "0.375rem", alignItems: "center", flexShrink: 0 }}>
                  <button
                    onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.75rem" }}
                  >
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

              {/* Expanded details */}
              {expanded === p.id && (
                <div style={{
                  marginTop: "0.75rem", paddingTop: "0.75rem",
                  borderTop: "1px solid var(--border)",
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
    </div>
  );
}