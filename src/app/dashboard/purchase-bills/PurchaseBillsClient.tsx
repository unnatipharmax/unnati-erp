"use client";
import { useState, useRef, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
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
  documentType?: "BILL" | "CREDIT_NOTE";
};

type ScanResult = {
  party: ExtractedParty;
  bill: ExtractedBill;
  products: ExtractedProduct[];
};

type SaveResult = {
  partyName: string;
  invoiceNo: string | null;
  documentType: string;
  totalAmount: number;
  netPayableAmount: number;
  creditNoteAdjustedAmount: number;
  newProducts: number;
  updProducts: number;
  creditNotesUsed: Array<{ id: string; invoiceNo: string | null; appliedAmount: number }>;
};

// ── Field component ─────────────────────────────────────────────────────────
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

// ── Product row ─────────────────────────────────────────────────────────────
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
          Item #{index + 1}
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
        <Field label="Item / Product Name *" value={product.name}        onChange={f("name")} />
        <Field label="Composition / Details" value={product.composition} onChange={f("composition")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <Field label="Manufacturer / Brand" value={product.manufacturer} onChange={f("manufacturer")} />
        <Field label="HSN Code"             value={product.hsn}          onChange={f("hsn")} mono />
        <Field label="Pack / Unit"          value={product.pack}         onChange={f("pack")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <Field label="Batch / Lot No" value={product.batchNo} onChange={f("batchNo")} mono />
        <Field label="Mfg Date"       value={product.mfgDate} onChange={f("mfgDate")} placeholder="e.g. Jul-25" />
        <Field label="Exp Date"       value={product.expDate} onChange={f("expDate")} placeholder="e.g. Jun-27" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.5rem" }}>
        <Field label="Quantity *"  value={product.quantity}   onChange={f("quantity")}   type="number" />
        <Field label="Rate (₹) *"  value={product.rate}       onChange={f("rate")}       type="number" />
        <Field label="Discount %"  value={product.discount}   onChange={f("discount")}   type="number" />
        <Field label="GST %"       value={product.gstPercent} onChange={f("gstPercent")} type="number" />
      </div>
      {product.rate > 0 && product.quantity > 0 && (
        <div style={{ marginTop: "0.4rem", fontSize: "0.72rem", color: "var(--text-secondary)", display: "flex", gap: "1rem" }}>
          <span>Line Total: <strong style={{ color: "var(--text-primary)" }}>₹{(product.rate * product.quantity).toFixed(2)}</strong></span>
          {product.gstPercent && (
            <span>With GST: <strong style={{ color: "#6ee7b7" }}>₹{(product.rate * product.quantity * (1 + product.gstPercent / 100)).toFixed(2)}</strong></span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Blank product ────────────────────────────────────────────────────────────
function blankProduct(): ExtractedProduct {
  return {
    name: "", composition: null, manufacturer: null, hsn: null, pack: null,
    batchNo: null, mfgDate: null, expDate: null, mrp: null, gstPercent: null,
    cgstPercent: null, sgstPercent: null, igstPercent: null, taxableAmount: null,
    cgstAmount: null, sgstAmount: null, igstAmount: null, quantity: 1, rate: 0, discount: null,
  };
}

// ── Main Page Component ──────────────────────────────────────────────────────
export default function PurchaseBillsClient() {
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
    setScanErr(""); setSaved(null); setData(null); setPreview(null);
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

    // Match against existing products
    const matchRes  = await fetch("/api/products");
    const matchData = await matchRes.json();
    const existing: any[] = matchData.products ?? [];

    const matched: ScanResult = {
      ...json.data,
      bill: { ...json.data.bill, documentType: "BILL" },
      products: (json.data.products ?? []).map((p: ExtractedProduct) => {
        const match = existing.find(ep => ep.name.toLowerCase() === p.name?.toLowerCase());
        return match ? { ...p, id: match.id } : p;
      }),
    };
    setData(matched);
    setScanning(false);
  }

  function resetAll() {
    setPreview(null); setData(null); setSaved(null); setScanErr(""); setSaveErr("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const setParty = useCallback((key: string, val: string) => {
    setData(d => d ? { ...d, party: { ...d.party, [key]: val || null } } : d);
  }, []);

  const setBill = useCallback((key: string, val: string) => {
    setData(d => {
      if (!d) return d;
      const numKeys = ["totalAmount"];
      return {
        ...d,
        bill: { ...d.bill, [key]: numKeys.includes(key) ? (val ? Number(val) : null) : (val || null) },
      };
    });
  }, []);

  const setProduct = useCallback((idx: number, key: string, val: string) => {
    setData(d => {
      if (!d) return d;
      const products = [...d.products];
      const numKeys = ["quantity","rate","mrp","gstPercent","cgstPercent","sgstPercent",
                       "igstPercent","taxableAmount","cgstAmount","sgstAmount","igstAmount","discount"];
      products[idx] = { ...products[idx], [key]: numKeys.includes(key) ? (val ? Number(val) : null) : (val || null) };
      return { ...d, products };
    });
  }, []);

  const removeProduct = useCallback((idx: number) => {
    setData(d => d ? { ...d, products: d.products.filter((_, i) => i !== idx) } : d);
  }, []);

  function addBlankProduct() {
    setData(d => d ? { ...d, products: [...d.products, blankProduct()] } : d);
  }

  function startManual() {
    setData({
      party: { name: "", address: null, gstNumber: null, drugLicenseNumber: null, phone: null, email: null },
      bill: { invoiceNo: null, invoiceDate: null, totalAmount: null, documentType: "BILL" },
      products: [blankProduct()],
    });
    setSaved(null); setScanErr(""); setSaveErr("");
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1>Purchase Bills</h1>
        <p style={{ marginTop: "0.25rem", color: "var(--text-secondary)" }}>
          Upload a purchase bill photo — AI will extract all details automatically
        </p>
      </div>

      {/* Success state */}
      {saved && (
        <div className="card" style={{ padding: "1.5rem", maxWidth: 600 }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>✅</div>
          <h3 style={{ margin: "0 0 0.5rem" }}>Bill Saved Successfully</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
            <div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Supplier</div>
              <div style={{ fontWeight: 600 }}>{saved.partyName}</div>
            </div>
            {saved.invoiceNo && (
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Invoice No</div>
                <div style={{ fontFamily: "monospace", fontWeight: 600 }}>{saved.invoiceNo}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Bill Amount</div>
              <div style={{ fontWeight: 600 }}>₹{saved.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Net Payable</div>
              <div style={{ fontWeight: 700, color: "#6ee7b7" }}>₹{saved.netPayableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          {saved.creditNoteAdjustedAmount > 0 && (
            <div className="alert" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#818cf8", marginBottom: "0.75rem", fontSize: "0.8rem" }}>
              ✓ Credit note applied: ₹{saved.creditNoteAdjustedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} adjusted automatically
            </div>
          )}

          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
            {saved.newProducts > 0 && <span style={{ color: "#6ee7b7" }}>{saved.newProducts} new item{saved.newProducts !== 1 ? "s" : ""} added to product master</span>}
            {saved.newProducts > 0 && saved.updProducts > 0 && " · "}
            {saved.updProducts > 0 && <span>{saved.updProducts} existing item{saved.updProducts !== 1 ? "s" : ""} updated</span>}
          </div>

          <button onClick={resetAll} className="btn btn-primary">
            + Record Another Bill
          </button>
        </div>
      )}

      {!saved && (
        <div style={{ display: "grid", gridTemplateColumns: data ? "300px 1fr" : "1fr", gap: "1.25rem", alignItems: "start" }}>

          {/* Left column: upload */}
          <div>
            <div className="card" style={{ padding: "1rem" }}>
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>Upload Bill</h3>

              {/* Drop zone */}
              <div
                onDrop={onDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${preview ? "rgba(99,102,241,0.5)" : "var(--border)"}`,
                  borderRadius: 10, padding: "1.5rem 1rem", textAlign: "center",
                  cursor: "pointer", marginBottom: "0.75rem",
                  background: preview ? "rgba(99,102,241,0.05)" : "var(--surface-2)",
                  transition: "all 0.2s",
                  minHeight: preview ? "auto" : 140,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                }}
              >
                {preview ? (
                  <img src={preview} alt="Bill preview" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 6, objectFit: "contain" }} />
                ) : (
                  <>
                    <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📄</div>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.25rem" }}>Drop bill image here</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>or click to browse</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>JPG · PNG · PDF · WEBP</div>
                  </>
                )}
              </div>
              <input
                ref={fileRef} type="file" accept="image/*,application/pdf"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                style={{ display: "none" }}
              />

              {preview && !data && (
                <button onClick={scan} disabled={scanning} className="btn btn-primary" style={{ width: "100%", marginBottom: "0.5rem" }}>
                  {scanning ? (
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="animate-spin">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                      </svg>
                      Scanning with AI…
                    </span>
                  ) : "✨ Extract with AI"}
                </button>
              )}

              {scanErr && (
                <div className="alert alert-error" style={{ fontSize: "0.78rem", marginBottom: "0.5rem" }}>{scanErr}</div>
              )}

              {data && (
                <div>
                  <div className="alert alert-success" style={{ padding: "0.4rem 0.6rem", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
                    ✓ {data.products.length} item{data.products.length !== 1 ? "s" : ""} extracted
                  </div>
                  <button onClick={resetAll} className="btn btn-secondary" style={{ width: "100%", fontSize: "0.78rem" }}>
                    ↺ Scan Different Bill
                  </button>
                </div>
              )}

              {!preview && !data && (
                <button onClick={startManual} className="btn btn-secondary" style={{ width: "100%", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                  ✏ Enter Manually
                </button>
              )}
            </div>
          </div>

          {/* Right column: review & edit */}
          {data && (
            <div>
              {/* Document type toggle */}
              <div className="card" style={{ padding: "0.75rem", marginBottom: "0.875rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, marginRight: "0.25rem" }}>Document Type:</span>
                  {(["BILL", "CREDIT_NOTE"] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setBill("documentType", type)}
                      style={{
                        padding: "4px 14px", borderRadius: 20, fontSize: "0.78rem", fontWeight: 600,
                        cursor: "pointer", border: "1px solid",
                        background: data.bill.documentType === type ? (type === "BILL" ? "rgba(99,102,241,0.15)" : "rgba(245,158,11,0.15)") : "var(--surface-2)",
                        color: data.bill.documentType === type ? (type === "BILL" ? "#818cf8" : "#fcd34d") : "var(--text-muted)",
                        borderColor: data.bill.documentType === type ? (type === "BILL" ? "#818cf8" : "#fcd34d") : "var(--border)",
                      }}
                    >
                      {type === "BILL" ? "Purchase Bill" : "Credit Note"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Supplier */}
              <div className="card" style={{ padding: "0.875rem", marginBottom: "0.875rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.75rem" }}>
                  <h3 style={{ margin: 0, fontSize: "0.9rem" }}>Supplier</h3>
                  {data.party.id
                    ? <span className="badge badge-blue" style={{ fontSize: "0.62rem" }}>Existing</span>
                    : <span className="badge badge-green" style={{ fontSize: "0.62rem" }}>New</span>
                  }
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <Field label="Supplier Name *" value={data.party.name}      onChange={v => setParty("name", v)} />
                  <Field label="GST Number"       value={data.party.gstNumber} onChange={v => setParty("gstNumber", v)} mono />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <Field label="Phone"   value={data.party.phone}   onChange={v => setParty("phone", v)} />
                  <Field label="Email"   value={data.party.email}   onChange={v => setParty("email", v)} />
                </div>
                <div style={{ marginTop: "0.5rem" }}>
                  <Field label="Address" value={data.party.address} onChange={v => setParty("address", v)} />
                </div>
              </div>

              {/* Bill Details */}
              <div className="card" style={{ padding: "0.875rem", marginBottom: "0.875rem" }}>
                <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}>Bill Details</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                  <Field label="Invoice / Bill No" value={data.bill.invoiceNo}   onChange={v => setBill("invoiceNo", v)}   mono />
                  <Field label="Invoice Date"       value={data.bill.invoiceDate} onChange={v => setBill("invoiceDate", v)} type="date" />
                  <Field label="Total Amount (₹)"   value={data.bill.totalAmount} onChange={v => setBill("totalAmount", v)} type="number" />
                </div>
              </div>

              {/* Items */}
              <div style={{ marginBottom: "0.875rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <h3 style={{ margin: 0, fontSize: "0.9rem" }}>
                    Items
                    <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.78rem", marginLeft: 8 }}>
                      ({data.products.filter(p => p.id).length} existing · {data.products.filter(p => !p.id).length} new)
                    </span>
                  </h3>
                  <button onClick={addBlankProduct} className="btn btn-secondary btn-sm" style={{ fontSize: "0.75rem" }}>+ Add Item</button>
                </div>

                {data.products.map((p, i) => (
                  <ProductRow key={i} product={p} index={i} onChange={setProduct} onRemove={removeProduct} />
                ))}

                {data.products.length === 0 && (
                  <div className="card" style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                    No items yet. Click "+ Add Item" to add manually.
                  </div>
                )}
              </div>

              {saveErr && (
                <div className="alert alert-error" style={{ marginBottom: "0.75rem", fontSize: "0.8rem" }}>{saveErr}</div>
              )}

              <button onClick={save} disabled={saving || data.products.length === 0} className="btn btn-primary" style={{ minWidth: 160 }}>
                {saving ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="animate-spin">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    Saving…
                  </span>
                ) : "✓ Save Bill"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
