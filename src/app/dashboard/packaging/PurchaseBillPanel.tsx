"use client";
import { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type ExtractedParty = {
  id?: string;
  name: string;
  address: string | null;
  gstNumber: string | null;
  drugLicenseNumber: string | null;
  phone: string | null;
  email: string | null;
};

type ExtractedProduct = {
  id?: string;
  name: string;
  composition: string | null;
  manufacturer: string | null;
  hsn: string | null;
  pack: string | null;
  batchNo: string | null;
  mfgDate: string | null;
  expDate: string | null;
  mrp: number | null;
  gstPercent: number | null;
  cgstPercent: number | null;
  sgstPercent: number | null;
  igstPercent: number | null;
  taxableAmount: number | null;
  cgstAmount: number | null;
  sgstAmount: number | null;
  igstAmount: number | null;
  quantity: number;
  rate: number;
  discount: number | null;
};

type ExtractedBill = {
  invoiceNo: string | null;
  invoiceDate: string | null;
  totalAmount: number | null;
};

type ScanResult = {
  party: ExtractedParty;
  bill: ExtractedBill;
  products: ExtractedProduct[];
};

type SaveResult = {
  partyName: string;
  invoiceNo: string | null;
  newProducts: number;
  updProducts: number;
};

// ── Editable field ─────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, type = "text", mono = false, placeholder,
}: {
  label: string; value: string | number | null; onChange: (v: string) => void;
  type?: string; mono?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label style={{ fontSize: "0.7rem", color: "var(--text-secondary)", display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </label>
      <input
        type={type}
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? `Enter ${label.toLowerCase()}`}
        style={{ fontFamily: mono ? "monospace" : undefined, fontSize: "0.8rem", padding: "0.4rem 0.6rem" }}
      />
    </div>
  );
}

// ── Compact product row ────────────────────────────────────────────────────────
function ProductRow({
  product, index, onChange, onRemove,
}: {
  product: ExtractedProduct; index: number;
  onChange: (idx: number, key: string, val: string) => void;
  onRemove: (idx: number) => void;
}) {
  const f = (key: string) => (val: string) => onChange(index, key, val);
  return (
    <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: "0.75rem", marginBottom: "0.6rem", border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>
          Product #{index + 1}
          {product.id
            ? <span className="badge badge-blue" style={{ marginLeft: 6, fontSize: "0.62rem" }}>Existing</span>
            : <span className="badge badge-green" style={{ marginLeft: 6, fontSize: "0.62rem" }}>New</span>
          }
        </span>
        <button onClick={() => onRemove(index)} style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: "0.72rem" }}>
          Remove
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <Field label="Brand Name *" value={product.name} onChange={f("name")} />
        <Field label="Composition"  value={product.composition} onChange={f("composition")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <Field label="Manufacturer" value={product.manufacturer} onChange={f("manufacturer")} />
        <Field label="HSN Code"     value={product.hsn} onChange={f("hsn")} mono />
        <Field label="Pack / Unit"  value={product.pack} onChange={f("pack")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <Field label="Batch No"  value={product.batchNo} onChange={f("batchNo")} mono />
        <Field label="Mfg Date"  value={product.mfgDate} onChange={f("mfgDate")} placeholder="e.g. Jul-25" />
        <Field label="Exp Date"  value={product.expDate} onChange={f("expDate")} placeholder="e.g. Jun-27" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.5rem" }}>
        <Field label="Quantity"   value={product.quantity} onChange={f("quantity")} type="number" />
        <Field label="Rate (₹) *" value={product.rate}     onChange={f("rate")}     type="number" />
        <Field label="MRP (₹)"   value={product.mrp}      onChange={f("mrp")}      type="number" />
        <Field label="GST %"      value={product.gstPercent} onChange={f("gstPercent")} type="number" />
      </div>
      {product.rate > 0 && (
        <div style={{ marginTop: "0.4rem", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
          INR Unit (rate + 15%) = <strong style={{ color: "#6ee7b7" }}>₹{(product.rate * 1.15).toFixed(2)}</strong>
        </div>
      )}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────
export default function PurchaseBillPanel({ onSaved }: { onSaved: () => void }) {
  const fileRef                 = useRef<HTMLInputElement>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [mime, setMime]         = useState("image/jpeg");
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr]   = useState("");
  const [data, setData]         = useState<ScanResult | null>(null);
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState("");
  const [saved, setSaved]       = useState<SaveResult | null>(null);

  function handleFile(file: File) {
    if (!file) return;
    setMime(file.type || "image/jpeg");
    setScanErr(""); setSaved(null); setData(null);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  async function scan() {
    if (!preview) return;
    setScanning(true); setScanErr(""); setData(null); setSaved(null);
    const base64 = preview.split(",")[1];
    const res  = await fetch("/api/purchase/scan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64, mimeType: mime }),
    });
    const json = await res.json();
    if (!res.ok) { setScanErr(json?.error || "Scan failed"); setScanning(false); return; }

    const matchRes  = await fetch("/api/products");
    const matchData = await matchRes.json();
    const existing: any[] = matchData.products ?? [];

    const matched: ScanResult = {
      ...json.data,
      products: (json.data.products ?? []).map((p: ExtractedProduct) => {
        const match = existing.find(ep => ep.name.toLowerCase() === p.name?.toLowerCase());
        return match ? { ...p, id: match.id } : p;
      }),
    };
    setData(matched);
    setScanning(false);
  }

  const setParty = useCallback((key: string, val: string) => {
    setData(d => d ? { ...d, party: { ...d.party, [key]: val || null } } : d);
  }, []);

  const setBill = useCallback((key: string, val: string) => {
    setData(d => d ? {
      ...d,
      bill: { ...d.bill, [key]: key === "totalAmount" ? (val ? Number(val) : null) : (val || null) },
    } : d);
  }, []);

  const setProduct = useCallback((idx: number, key: string, val: string) => {
    setData(d => {
      if (!d) return d;
      const products = [...d.products];
      const num = ["quantity","rate","mrp","gstPercent","cgstPercent","sgstPercent",
                   "igstPercent","taxableAmount","cgstAmount","sgstAmount","igstAmount","discount"];
      products[idx] = { ...products[idx], [key]: num.includes(key) ? (val ? Number(val) : null) : (val || null) };
      return { ...d, products };
    });
  }, []);

  const removeProduct = useCallback((idx: number) => {
    setData(d => d ? { ...d, products: d.products.filter((_, i) => i !== idx) } : d);
  }, []);

  function addBlankProduct() {
    setData(d => d ? {
      ...d,
      products: [...d.products, {
        name: "", composition: null, manufacturer: null, hsn: null, pack: null,
        batchNo: null, mfgDate: null, expDate: null, mrp: null, gstPercent: null,
        cgstPercent: null, sgstPercent: null, igstPercent: null, taxableAmount: null,
        cgstAmount: null, sgstAmount: null, igstAmount: null, quantity: 1, rate: 0, discount: null,
      }],
    } : d);
  }

  async function save() {
    if (!data) return;
    setSaving(true); setSaveErr("");
    const res  = await fetch("/api/purchase/save", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) { setSaveErr(json?.error || "Save failed"); setSaving(false); return; }
    setSaved(json.result);
    setSaving(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--surface-2)", borderRadius: 12, border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
        <h4 style={{ margin: 0, fontSize: "0.9rem" }}>Upload Purchase Bill</h4>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Gemini will extract the data automatically</span>
      </div>

      {/* Success state */}
      {saved && (
        <div>
          <div className="alert alert-success" style={{ marginBottom: "0.75rem" }}>
            <strong>✓ Saved!</strong> Party: <strong>{saved.partyName}</strong>
            {saved.invoiceNo && <> · Invoice: <strong>{saved.invoiceNo}</strong></>}
            {" · "}
            <span style={{ color: "#6ee7b7" }}>{saved.newProducts} new</span>
            {saved.updProducts > 0 && <span> · {saved.updProducts} updated</span>}
            {" products in product master."}
          </div>
          <button onClick={onSaved} className="btn btn-primary btn-sm">
            ✓ Mark In Stock &amp; Generate Invoice
          </button>
        </div>
      )}

      {!saved && (
        <div style={{ display: "grid", gridTemplateColumns: data ? "280px 1fr" : "1fr", gap: "1rem", alignItems: "start" }}>

          {/* Upload column */}
          <div>
            <div
              onDrop={onDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${preview ? "rgba(99,102,241,0.4)" : "var(--border)"}`,
                borderRadius: 10, padding: "1.25rem 0.75rem", textAlign: "center",
                cursor: "pointer", marginBottom: "0.75rem",
                background: preview ? "rgba(99,102,241,0.04)" : "var(--surface-1)",
                transition: "all 0.2s",
              }}
            >
              {preview ? (
                <img src={preview} alt="Bill" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 6, objectFit: "contain" }} />
              ) : (
                <>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>📄</div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.2rem" }}>Drop bill image here</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>or click · JPG, PNG, PDF</div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} style={{ display: "none" }} />

            {preview && !data && (
              <button onClick={scan} disabled={scanning} className="btn btn-primary" style={{ width: "100%", fontSize: "0.85rem" }}>
                {scanning ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="animate-spin">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    Scanning…
                  </span>
                ) : "Scan with AI"}
              </button>
            )}

            {scanErr && <div className="alert alert-error" style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>{scanErr}</div>}

            {data && (
              <div style={{ marginTop: "0.75rem" }}>
                <div className="alert alert-success" style={{ padding: "0.4rem 0.6rem", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
                  ✓ {data.products.length} product{data.products.length !== 1 ? "s" : ""} extracted
                </div>
                <button onClick={() => { setPreview(null); setData(null); if (fileRef.current) fileRef.current.value = ""; }} className="btn btn-secondary" style={{ width: "100%", fontSize: "0.78rem" }}>
                  ↺ Scan Different Bill
                </button>
              </div>
            )}
          </div>

          {/* Review column */}
          {data && (
            <div>
              {/* Party */}
              <div className="card" style={{ marginBottom: "0.875rem", padding: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.6rem" }}>
                  <h4 style={{ margin: 0, fontSize: "0.85rem" }}>Supplier</h4>
                  {data.party.id
                    ? <span className="badge badge-blue" style={{ fontSize: "0.62rem" }}>Existing</span>
                    : <span className="badge badge-green" style={{ fontSize: "0.62rem" }}>New</span>
                  }
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <Field label="Party Name *" value={data.party.name} onChange={v => setParty("name", v)} />
                  <Field label="GST Number"   value={data.party.gstNumber} onChange={v => setParty("gstNumber", v)} mono />
                </div>
                <Field label="Address" value={data.party.address} onChange={v => setParty("address", v)} />
              </div>

              {/* Bill */}
              <div className="card" style={{ marginBottom: "0.875rem", padding: "0.75rem" }}>
                <h4 style={{ margin: "0 0 0.6rem", fontSize: "0.85rem" }}>Bill Details</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                  <Field label="Invoice No"   value={data.bill.invoiceNo}   onChange={v => setBill("invoiceNo", v)}   mono />
                  <Field label="Invoice Date" value={data.bill.invoiceDate} onChange={v => setBill("invoiceDate", v)} type="date" />
                  <Field label="Total Amount" value={data.bill.totalAmount} onChange={v => setBill("totalAmount", v)} type="number" />
                </div>
              </div>

              {/* Products */}
              <div style={{ marginBottom: "0.875rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                  <h4 style={{ margin: 0, fontSize: "0.85rem" }}>
                    Products
                    <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.78rem", marginLeft: 6 }}>
                      ({data.products.filter(p => p.id).length} existing · {data.products.filter(p => !p.id).length} new)
                    </span>
                  </h4>
                  <button onClick={addBlankProduct} className="btn btn-secondary btn-sm" style={{ fontSize: "0.75rem" }}>+ Add</button>
                </div>
                {data.products.map((p, i) => (
                  <ProductRow key={i} product={p} index={i} onChange={setProduct} onRemove={removeProduct} />
                ))}
                {data.products.length === 0 && (
                  <div className="card" style={{ textAlign: "center", padding: "1rem", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                    No products. Click "+ Add" to add manually.
                  </div>
                )}
              </div>

              {saveErr && <div className="alert alert-error" style={{ marginBottom: "0.5rem", fontSize: "0.8rem" }}>{saveErr}</div>}

              <button onClick={save} disabled={saving} className="btn btn-primary">
                {saving ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="animate-spin">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    Saving…
                  </span>
                ) : "✓ Save to Product Master"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
