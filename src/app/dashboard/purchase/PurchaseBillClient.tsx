"use client";
import { useState, useRef, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
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

// ── Editable field ────────────────────────────────────────────────────────────
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
        style={{
          fontFamily: mono ? "monospace" : undefined,
          fontSize: "0.8rem",
          padding: "0.4rem 0.6rem",
        }}
      />
    </div>
  );
}

// ── Product row editor ────────────────────────────────────────────────────────
function ProductRow({
  product, index, onChange, onRemove,
}: {
  product: ExtractedProduct;
  index: number;
  onChange: (idx: number, key: string, val: string) => void;
  onRemove: (idx: number) => void;
}) {
  const f = (key: string) => (val: string) => onChange(index, key, val);
  return (
    <div style={{
      background: "var(--surface-2)", borderRadius: 12,
      padding: "0.875rem", marginBottom: "0.75rem",
      border: "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.625rem" }}>
        <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)" }}>
          Product #{index + 1}
          {product.id && <span className="badge badge-blue" style={{ marginLeft: 8, fontSize: "0.65rem" }}>Existing — will update</span>}
          {!product.id && <span className="badge badge-green" style={{ marginLeft: 8, fontSize: "0.65rem" }}>New</span>}
        </span>
        <button
          onClick={() => onRemove(index)}
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171", borderRadius: 6, padding: "2px 10px", cursor: "pointer", fontSize: "0.75rem" }}
        >
          Remove
        </button>
      </div>

      {/* Row 1: Name + Composition */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
        <Field label="Brand Name *"  value={product.name}        onChange={f("name")}        placeholder="e.g. MORNING PILLS" />
        <Field label="Composition"   value={product.composition} onChange={f("composition")} placeholder="e.g. LEVONORGESTREL 1.5MG" />
      </div>

      {/* Row 2: Manufacturer + HSN + Pack */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
        <Field label="Manufacturer"  value={product.manufacturer} onChange={f("manufacturer")} />
        <Field label="HSN Code"      value={product.hsn}          onChange={f("hsn")}          mono />
        <Field label="Pack / Unit"   value={product.pack}         onChange={f("pack")}         placeholder="e.g. 1TAB" />
      </div>

      {/* Row 3: Batch + Mfg + Exp */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        gap: "0.6rem", marginBottom: "0.6rem",
        background: "rgba(59,130,246,0.04)", borderRadius: 8, padding: "0.5rem",
        border: "1px solid rgba(59,130,246,0.1)",
      }}>
        <Field label="Batch No"  value={product.batchNo} onChange={f("batchNo")} mono placeholder="e.g. DH250092B" />
        <Field label="Mfg Date"  value={product.mfgDate} onChange={f("mfgDate")} placeholder="e.g. Jul-25" />
        <Field label="Exp Date"  value={product.expDate} onChange={f("expDate")} placeholder="e.g. Jun-27" />
      </div>

      {/* Row 4: Qty + Rate + MRP + Discount */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
        <Field label="Quantity"    value={product.quantity}  onChange={f("quantity")}  type="number" />
        <Field label="Rate (₹) *"  value={product.rate}      onChange={f("rate")}      type="number" placeholder="Purchase rate" />
        <Field label="MRP (₹)"    value={product.mrp}       onChange={f("mrp")}       type="number" />
        <Field label="Discount %"  value={product.discount}  onChange={f("discount")}  type="number" />
      </div>

      {/* Row 5: GST Breakdown */}
      <div style={{
        background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.12)",
        borderRadius: 8, padding: "0.5rem", marginBottom: "0.5rem",
      }}>
        <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginBottom: "0.4rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          GST Breakdown (for CA purposes)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.4rem" }}>
          <Field label="Total GST %"  value={product.gstPercent}  onChange={f("gstPercent")}  type="number" placeholder="5" />
          <Field label="CGST %"       value={product.cgstPercent} onChange={f("cgstPercent")} type="number" placeholder="2.5" />
          <Field label="SGST %"       value={product.sgstPercent} onChange={f("sgstPercent")} type="number" placeholder="2.5" />
          <Field label="IGST %"       value={product.igstPercent} onChange={f("igstPercent")} type="number" placeholder="0" />
          <Field label="Taxable Amt"  value={product.taxableAmount} onChange={f("taxableAmount")} type="number" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
          <Field label="CGST Amount (₹)" value={product.cgstAmount} onChange={f("cgstAmount")} type="number" />
          <Field label="SGST Amount (₹)" value={product.sgstAmount} onChange={f("sgstAmount")} type="number" />
          <Field label="IGST Amount (₹)" value={product.igstAmount} onChange={f("igstAmount")} type="number" />
        </div>
        {/* GST summary badge */}
        {(product.cgstPercent || product.igstPercent) && (
          <div style={{ marginTop: "0.4rem", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
            {product.cgstPercent && product.sgstPercent
              ? <span>CGST {product.cgstPercent}% + SGST {product.sgstPercent}% = <strong style={{color:"#6ee7b7"}}>{product.gstPercent}% total</strong></span>
              : <span>IGST <strong style={{color:"#6ee7b7"}}>{product.igstPercent}%</strong> (interstate)</span>
            }
            {product.cgstAmount && product.sgstAmount && (
              <span style={{marginLeft:8}}>· ₹{product.cgstAmount} + ₹{product.sgstAmount} = <strong>₹{((product.cgstAmount||0)+(product.sgstAmount||0)).toFixed(2)}</strong></span>
            )}
          </div>
        )}
      </div>

      {/* INR Unit preview */}
      {product.rate > 0 && (
        <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          INR Unit on invoice (rate + 15%) = <strong style={{ color: "#6ee7b7" }}>
            ₹{(product.rate * 1.15).toFixed(2)}
          </strong>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PurchaseBillClient() {
  const fileRef               = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mime,    setMime]    = useState("image/jpeg");
  const [scanning, setScanning] = useState(false);
  const [scanErr,  setScanErr]  = useState("");
  const [data,     setData]     = useState<ScanResult | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [saveErr,  setSaveErr]  = useState("");
  const [saved,    setSaved]    = useState<SaveResult | null>(null);

  // ── File pick ──────────────────────────────────────────────────────────────
  function handleFile(file: File) {
    if (!file) return;
    setMime(file.type || "image/jpeg");
    setScanErr(""); setSaved(null); setData(null);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  // ── Scan ───────────────────────────────────────────────────────────────────
  async function scan() {
    if (!preview) return;
    setScanning(true); setScanErr(""); setData(null); setSaved(null);

    // Strip data URL prefix → pure base64
    const base64 = preview.split(",")[1];

    const res  = await fetch("/api/purchase/scan", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ imageBase64: base64, mimeType: mime }),
    });
    const json = await res.json();

    if (!res.ok) {
      setScanErr(json?.error || "Scan failed");
      setScanning(false);
      return;
    }

    // Match products to existing product master by name
    const matchRes = await fetch("/api/products");
    const matchData = await matchRes.json();
    const existingProducts: any[] = matchData.products ?? [];

    const matched: ScanResult = {
      ...json.data,
      products: (json.data.products ?? []).map((p: ExtractedProduct) => {
        const match = existingProducts.find(
          ep => ep.name.toLowerCase() === p.name?.toLowerCase()
        );
        return match ? { ...p, id: match.id } : p;
      }),
    };

    setData(matched);
    setScanning(false);
  }

  // ── Field updaters ─────────────────────────────────────────────────────────
  const setParty = useCallback((key: string, val: string) => {
    setData(d => d ? { ...d, party: { ...d.party, [key]: val || null } } : d);
  }, []);

  const setBill = useCallback((key: string, val: string) => {
    setData(d => d ? {
      ...d,
      bill: {
        ...d.bill,
        [key]: key === "totalAmount" ? (val ? Number(val) : null) : (val || null),
      },
    } : d);
  }, []);

  const setProduct = useCallback((idx: number, key: string, val: string) => {
    setData(d => {
      if (!d) return d;
      const products = [...d.products];
      const num = ["quantity","rate","mrp","gstPercent","cgstPercent","sgstPercent",
                   "igstPercent","taxableAmount","cgstAmount","sgstAmount","igstAmount","discount"];
      products[idx] = {
        ...products[idx],
        [key]: num.includes(key) ? (val ? Number(val) : null) : (val || null),
      };
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
        name: "", composition: null, manufacturer: null, hsn: null,
        pack: null, batchNo: null, mfgDate: null, expDate: null,
        mrp: null, gstPercent: null, cgstPercent: null, sgstPercent: null,
        igstPercent: null, taxableAmount: null, cgstAmount: null,
        sgstAmount: null, igstAmount: null, quantity: 1, rate: 0, discount: null,
      }],
    } : d);
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function save() {
    if (!data) return;
    setSaving(true); setSaveErr("");

    const res  = await fetch("/api/purchase/save", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    const json = await res.json();

    if (!res.ok) { setSaveErr(json?.error || "Save failed"); setSaving(false); return; }

    setSaved(json.result);
    setSaving(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1>Purchase Bill</h1>
        <p style={{ marginTop: "0.25rem" }}>Upload a purchase bill image — Gemini will extract all details automatically.</p>
      </div>

      {/* ── Success banner ── */}
      {saved && (
        <div className="alert alert-success" style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <strong>✓ Saved successfully!</strong>{" "}
            Party: <strong>{saved.partyName}</strong>
            {saved.invoiceNo && <> · Invoice: <strong>{saved.invoiceNo}</strong></>}
            {" · "}
            <span style={{ color: "#6ee7b7" }}>{saved.newProducts} new products</span>
            {saved.updProducts > 0 && <span> · {saved.updProducts} updated</span>}
          </div>
          <button
            onClick={() => { setData(null); setPreview(null); setSaved(null); setScanErr(""); if (fileRef.current) fileRef.current.value = ""; }}
            className="btn btn-sm btn-secondary"
          >
            + Scan Another Bill
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: saved ? "1fr" : "340px 1fr", gap: "1.5rem", alignItems: "start" }}>

        {/* ── Left: Upload panel ── */}
        {!saved && (
          <div>
            {/* Drop zone */}
            <div
              onDrop={onDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${preview ? "rgba(99,102,241,0.4)" : "var(--border)"}`,
                borderRadius: 14, padding: "2rem 1rem", textAlign: "center",
                cursor: "pointer", marginBottom: "1rem",
                background: preview ? "rgba(99,102,241,0.04)" : "var(--surface-2)",
                transition: "all 0.2s",
              }}
            >
              {preview ? (
                <img src={preview} alt="Bill preview" style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 8, objectFit: "contain" }} />
              ) : (
                <>
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📄</div>
                  <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Drop bill image here</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>or click to browse · JPG, PNG, WebP, PDF</div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={onFileChange} style={{ display: "none" }} />

            {preview && !data && (
              <button onClick={scan} disabled={scanning} className="btn btn-primary" style={{ width: "100%" }}>
                {scanning ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    Scanning with Gemini…
                  </span>
                ) : "✨ Scan Bill with AI"}
              </button>
            )}

            {scanErr && (
              <div className="alert alert-error" style={{ marginTop: "0.75rem" }}>{scanErr}</div>
            )}

            {data && (
              <div style={{ marginTop: "1rem" }}>
                <div className="alert alert-success" style={{ marginBottom: "0.75rem", padding: "0.5rem 0.75rem", fontSize: "0.8rem" }}>
                  ✓ Extracted {data.products.length} product{data.products.length !== 1 ? "s" : ""} — review and save
                </div>
                <button onClick={() => { setPreview(null); setData(null); if (fileRef.current) fileRef.current.value = ""; }} className="btn btn-secondary" style={{ width: "100%", fontSize: "0.8rem" }}>
                  ↺ Scan Different Bill
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Right: Review panel ── */}
        {data && !saved && (
          <div>
            {/* ── Party ── */}
            <div className="card" style={{ marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
                <h3 style={{ margin: 0 }}>Supplier / Party</h3>
                {data.party.id
                  ? <span className="badge badge-blue" style={{ fontSize: "0.65rem" }}>Existing — will update</span>
                  : <span className="badge badge-green" style={{ fontSize: "0.65rem" }}>New party</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
                <Field label="Party Name *"     value={data.party.name}              onChange={v => setParty("name", v)} />
                <Field label="GST Number"       value={data.party.gstNumber}         onChange={v => setParty("gstNumber", v)} mono />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
                <Field label="Drug License No"  value={data.party.drugLicenseNumber} onChange={v => setParty("drugLicenseNumber", v)} mono />
                <Field label="Phone"            value={data.party.phone}             onChange={v => setParty("phone", v)} />
              </div>
              <Field label="Address"            value={data.party.address}           onChange={v => setParty("address", v)} />
            </div>

            {/* ── Bill ── */}
            <div className="card" style={{ marginBottom: "1.25rem" }}>
              <h3 style={{ marginBottom: "0.875rem" }}>Bill Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.6rem" }}>
                <Field label="Invoice No"   value={data.bill.invoiceNo}   onChange={v => setBill("invoiceNo", v)}   mono />
                <Field label="Invoice Date" value={data.bill.invoiceDate} onChange={v => setBill("invoiceDate", v)} type="date" />
                <Field label="Total Amount" value={data.bill.totalAmount} onChange={v => setBill("totalAmount", v)} type="number" />
              </div>
            </div>

            {/* ── Products ── */}
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
                <h3 style={{ margin: 0 }}>
                  Products
                  <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.875rem", marginLeft: 8 }}>
                    ({data.products.filter(p => p.id).length} existing · {data.products.filter(p => !p.id).length} new)
                  </span>
                </h3>
                <button onClick={addBlankProduct} className="btn btn-secondary btn-sm">+ Add Product</button>
              </div>

              {data.products.map((p, i) => (
                <ProductRow
                  key={i} product={p} index={i}
                  onChange={setProduct} onRemove={removeProduct}
                />
              ))}

              {data.products.length === 0 && (
                <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                  No products extracted. Click "+ Add Product" to add manually.
                </div>
              )}
            </div>

            {/* ── Save ── */}
            {saveErr && <div className="alert alert-error" style={{ marginBottom: "0.75rem" }}>{saveErr}</div>}

            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <button onClick={save} disabled={saving} className="btn btn-primary" style={{ minWidth: 180 }}>
                {saving ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    Saving…
                  </span>
                ) : "✓ Save All to System"}
              </button>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Saves party, {data.products.length} product{data.products.length !== 1 ? "s" : ""} &amp; purchase bill
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}