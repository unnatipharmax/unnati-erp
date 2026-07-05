"use client";
import { useEffect, useState, useCallback } from "react";

type Company = {
  id: string; name: string; address: string; email: string; phone: string;
  website: string; indiamart: string; marketing: string; gstin: string; iec: string;
  drugLic: string; chaName: string; chaNo: string; invoicePrefix: string;
  bankName: string; bankAccount: string; bankIfsc: string; bankBranch: string; bankSwift: string;
  logoB64: string; stampB64: string; sigB64: string; isActive: boolean;
};

type ListItem = { id: string; name: string; gstin: string; invoicePrefix: string; logoB64: string };

const FIELDS: { key: keyof Company; label: string; wide?: boolean }[] = [
  { key: "name", label: "Company Name", wide: true },
  { key: "address", label: "Address", wide: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "gstin", label: "GSTIN" },
  { key: "iec", label: "IEC Code" },
  { key: "drugLic", label: "Drug License No." },
  { key: "invoicePrefix", label: "Invoice Prefix (e.g. E)" },
  { key: "website", label: "Website" },
  { key: "indiamart", label: "IndiaMART / Store" },
  { key: "marketing", label: "Marketing Site" },
  { key: "chaName", label: "CHA Name" },
  { key: "chaNo", label: "CHA No." },
  { key: "bankName", label: "Bank Name" },
  { key: "bankAccount", label: "Bank A/C No." },
  { key: "bankIfsc", label: "Bank IFSC" },
  { key: "bankBranch", label: "Bank Branch", wide: true },
  { key: "bankSwift", label: "Swift Code" },
];

const IMAGES: { key: "logoB64" | "stampB64" | "sigB64"; label: string }[] = [
  { key: "logoB64", label: "Logo" },
  { key: "stampB64", label: "Company Stamp" },
  { key: "sigB64", label: "Signature" },
];

export default function CompaniesClient() {
  const [list, setList] = useState<ListItem[]>([]);
  const [editing, setEditing] = useState<Company | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const loadList = useCallback(async () => {
    const r = await fetch("/api/companies");
    const d = await r.json();
    setList(d.companies ?? []);
  }, []);
  useEffect(() => { loadList(); }, [loadList]);

  async function openEdit(id: string) {
    setErr(""); setMsg("");
    const r = await fetch(`/api/companies/${id}`);
    const d = await r.json();
    if (r.ok) { setEditing(d.company); setCreating(false); }
    else setErr(d?.error || "Failed to load company");
  }

  function openCreate() {
    setErr(""); setMsg("");
    setEditing({
      id: "", name: "", address: "", email: "", phone: "", website: "", indiamart: "",
      marketing: "", gstin: "", iec: "", drugLic: "", chaName: "", chaNo: "", invoicePrefix: "E",
      bankName: "", bankAccount: "", bankIfsc: "", bankBranch: "", bankSwift: "",
      logoB64: "", stampB64: "", sigB64: "", isActive: true,
    });
    setCreating(true);
  }

  function set(k: keyof Company, v: string) { setEditing(e => e ? { ...e, [k]: v } : e); }

  async function pickImage(key: "logoB64" | "stampB64" | "sigB64", file: File) {
    const dataUrl: string = await new Promise((res, rej) => {
      const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file);
    });
    set(key, dataUrl);
  }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) { setErr("Company name is required"); return; }
    setSaving(true); setErr(""); setMsg("");
    try {
      const url = creating ? "/api/companies" : `/api/companies/${editing.id}`;
      const method = creating ? "POST" : "PUT";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing) });
      const d = await r.json();
      if (!r.ok) { setErr(d?.error || "Save failed"); return; }
      setMsg(creating ? "Company created." : "Company saved.");
      setEditing(null); setCreating(false);
      loadList();
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = { width: "100%", padding: "0.45rem 0.6rem", fontSize: "0.85rem", borderRadius: 8, border: "1px solid var(--border)", boxSizing: "border-box" };

  return (
    <div style={{ padding: "2rem", maxWidth: 1000 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>Companies</h1>
          <p style={{ marginTop: "0.25rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Each company has its own data, invoice sequence and branding (GSTIN, IEC, bank, logo) on documents.
          </p>
        </div>
        {!editing && <button onClick={openCreate} className="btn btn-primary">+ Add Company</button>}
      </div>

      {msg && <div className="alert alert-success" style={{ marginBottom: "1rem" }}>{msg}</div>}
      {err && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{err}</div>}

      {/* List */}
      {!editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {list.map(c => (
            <div key={c.id} className="card" style={{ padding: "0.875rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.logoB64 && c.logoB64.length > 20 ? c.logoB64 : "/logo.png"} alt="" style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 6 }} />
                <div>
                  <div style={{ fontWeight: 700 }}>{c.name}</div>
                  <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                    {c.gstin || "No GSTIN"} · prefix {c.invoicePrefix}
                  </div>
                </div>
              </div>
              <button onClick={() => openEdit(c.id)} className="btn btn-secondary btn-sm">Edit</button>
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      {editing && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "1rem" }}>
            {creating ? "New Company" : `Edit — ${editing.name}`}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem 1rem" }}>
            {FIELDS.map(f => (
              <div key={f.key} style={{ gridColumn: f.wide ? "1 / -1" : "auto" }}>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: 3 }}>{f.label}</label>
                <input style={inputStyle} value={String(editing[f.key] ?? "")} onChange={e => set(f.key, e.target.value)} />
              </div>
            ))}
          </div>

          {/* Images */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginTop: "1.25rem" }}>
            {IMAGES.map(img => {
              const val = editing[img.key];
              const has = val && val.length > 20;
              return (
                <div key={img.key} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "0.75rem", textAlign: "center" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 6 }}>{img.label}</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {has ? <img src={val} alt={img.label} style={{ maxWidth: "100%", maxHeight: 64, objectFit: "contain", marginBottom: 6 }} />
                       : <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.72rem" }}>None</div>}
                  <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                    <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer", fontSize: "0.72rem" }}>
                      Upload
                      <input type="file" accept="image/*" style={{ display: "none" }}
                        onChange={e => { const file = e.target.files?.[0]; if (file) pickImage(img.key, file); e.target.value = ""; }} />
                    </label>
                    {has && <button onClick={() => set(img.key, "")} className="btn btn-secondary btn-sm" style={{ fontSize: "0.72rem" }}>Clear</button>}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button onClick={save} disabled={saving} className="btn btn-primary">
              {saving ? "Saving…" : creating ? "Create Company" : "Save Changes"}
            </button>
            <button onClick={() => { setEditing(null); setCreating(false); setErr(""); }} className="btn btn-secondary">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
