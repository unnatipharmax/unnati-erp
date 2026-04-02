"use client";

import { useEffect, useState } from "react";
import { getCreditNoteLineAmount } from "../../../lib/purchaseAccounting";

type ProductOption = {
  id: string;
  name: string;
  composition: string | null;
  pack: string | null;
  batchNo: string | null;
  expDate: string | null;
  latestRate: number | null;
  gstPercent: number | null;
};

type CreditNoteRow = {
  productId?: string;
  name: string;
  composition: string;
  pack: string;
  batchNo: string;
  expDate: string;
  quantity: string;
  rate: string;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  gstPercent: string;
};

function today() {
  return new Date().toISOString().split("T")[0];
}

function fmt(amount: number) {
  return "Rs. " + amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function emptyRow(): CreditNoteRow {
  return {
    name: "",
    composition: "",
    pack: "",
    batchNo: "",
    expDate: "",
    quantity: "1",
    rate: "",
    taxableAmount: "",
    cgstAmount: "",
    sgstAmount: "",
    igstAmount: "",
    gstPercent: "",
  };
}

export default function CreditNoteEntryTab({
  partyId,
  partyName,
  onAdded,
}: {
  partyId: string;
  partyName: string;
  onAdded: () => void;
}) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [rows, setRows] = useState<CreditNoteRow[]>([emptyRow()]);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.products ?? []);
        setLoadingProducts(false);
      })
      .catch(() => setLoadingProducts(false));
  }, []);

  function updateRow(index: number, key: keyof CreditNoteRow, value: string) {
    setRows((current) => {
      const next = [...current];
      const row = { ...next[index], [key]: value };

      if (key === "name") {
        const match = products.find(
          (product) => product.name.toLowerCase() === value.trim().toLowerCase()
        );

        if (match) {
          row.productId = match.id;
          row.composition = row.composition || match.composition || "";
          row.pack = row.pack || match.pack || "";
          row.batchNo = row.batchNo || match.batchNo || "";
          row.expDate = row.expDate || match.expDate || "";
          row.rate = row.rate || (match.latestRate != null ? String(match.latestRate) : "");
          row.gstPercent = row.gstPercent || (match.gstPercent != null ? String(match.gstPercent) : "");
        } else {
          row.productId = undefined;
        }
      }

      next[index] = row;
      return next;
    });
  }

  function addRow() {
    setRows((current) => [...current, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((current) => current.length === 1 ? current : current.filter((_, i) => i !== index));
  }

  const activeRows = rows.filter((row) => row.name.trim());
  const totalAmount = activeRows.reduce((sum, row) => sum + getCreditNoteLineAmount({
    quantity: Number(row.quantity) || 0,
    rate: Number(row.rate) || 0,
    taxableAmount: row.taxableAmount ? Number(row.taxableAmount) : null,
    cgstAmount: row.cgstAmount ? Number(row.cgstAmount) : null,
    sgstAmount: row.sgstAmount ? Number(row.sgstAmount) : null,
    igstAmount: row.igstAmount ? Number(row.igstAmount) : null,
  }), 0);

  async function submit() {
    if (activeRows.length === 0) {
      setErr("Add at least one returned product.");
      return;
    }

    const invalidRow = activeRows.find((row) => (Number(row.quantity) || 0) <= 0 || (Number(row.rate) || 0) < 0);
    if (invalidRow) {
      setErr("Each row needs a valid quantity and rate.");
      return;
    }

    setSaving(true);
    setErr("");
    setSuccess("");

    const payload = {
      party: { id: partyId, name: partyName },
      bill: {
        invoiceNo: invoiceNo || null,
        invoiceDate: invoiceDate || null,
        totalAmount,
        documentType: "CREDIT_NOTE",
      },
      products: activeRows.map((row) => ({
        id: row.productId,
        name: row.name.trim(),
        composition: row.composition || null,
        pack: row.pack || null,
        batchNo: row.batchNo || null,
        expDate: row.expDate || null,
        quantity: Number(row.quantity) || 0,
        rate: Number(row.rate) || 0,
        gstPercent: row.gstPercent ? Number(row.gstPercent) : null,
        taxableAmount: row.taxableAmount ? Number(row.taxableAmount) : null,
        cgstAmount: row.cgstAmount ? Number(row.cgstAmount) : null,
        sgstAmount: row.sgstAmount ? Number(row.sgstAmount) : null,
        igstAmount: row.igstAmount ? Number(row.igstAmount) : null,
        discount: null,
      })),
    };

    const res = await fetch("/api/purchase/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setErr(data?.error || "Failed to save credit note");
      setSaving(false);
      return;
    }

    setSuccess(`Credit note of ${fmt(totalAmount)} recorded for ${partyName}.`);
    setInvoiceNo("");
    setInvoiceDate(today());
    setRows([emptyRow()]);
    setSaving(false);
    onAdded();
  }

  return (
    <div style={{ padding: "1.5rem", maxWidth: 960 }}>
      <h3 style={{ margin: "0 0 1rem", fontSize: "0.95rem", fontWeight: 700 }}>New Credit Note</h3>

      <div style={{
        marginBottom: "1rem",
        padding: "0.8rem 1rem",
        borderRadius: 10,
        border: "1px solid rgba(251,146,60,0.2)",
        background: "rgba(251,146,60,0.08)",
        fontSize: "0.82rem",
        color: "var(--text-secondary)",
      }}>
        Return adjustment is calculated without reducing it for bill discount. Any open credit-note balance will auto-adjust against the next purchase bill for this party.
      </div>

      {err && <div className="alert alert-error" style={{ marginBottom: "1rem", fontSize: "0.82rem" }}>{err}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: "1rem", fontSize: "0.82rem" }}>{success}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: "0.875rem", marginBottom: "1rem" }}>
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Credit Note No.</label>
          <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="Optional CN reference" style={{ fontFamily: "monospace" }} />
        </div>
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Credit Note Date</label>
          <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Products</label>
          <div style={{
            height: 42,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--surface-2)",
            fontWeight: 700,
            fontFamily: "monospace",
          }}>
            {activeRows.length}
          </div>
        </div>
      </div>

      <datalist id="credit-note-products">
        {products.map((product) => (
          <option key={product.id} value={product.name} />
        ))}
      </datalist>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
        {rows.map((row, index) => {
          const lineAmount = getCreditNoteLineAmount({
            quantity: Number(row.quantity) || 0,
            rate: Number(row.rate) || 0,
            taxableAmount: row.taxableAmount ? Number(row.taxableAmount) : null,
            cgstAmount: row.cgstAmount ? Number(row.cgstAmount) : null,
            sgstAmount: row.sgstAmount ? Number(row.sgstAmount) : null,
            igstAmount: row.igstAmount ? Number(row.igstAmount) : null,
          });

          return (
            <div key={index} style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              background: "var(--surface-2)",
              padding: "0.875rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.84rem" }}>Returned Product #{index + 1}</div>
                <button
                  onClick={() => removeRow(index)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.72rem" }}
                >
                  Remove
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Product Name *</label>
                  <input
                    list="credit-note-products"
                    value={row.name}
                    onChange={(e) => updateRow(index, "name", e.target.value)}
                    placeholder={loadingProducts ? "Loading products..." : "Select or type product"}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Pack</label>
                  <input value={row.pack} onChange={(e) => updateRow(index, "pack", e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Batch</label>
                  <input value={row.batchNo} onChange={(e) => updateRow(index, "batchNo", e.target.value)} style={{ fontFamily: "monospace" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Expiry</label>
                  <input value={row.expDate} onChange={(e) => updateRow(index, "expDate", e.target.value)} placeholder="e.g. Jun-27" />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 90px 110px 110px 90px", gap: "0.6rem", marginBottom: "0.6rem" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Composition</label>
                  <input value={row.composition} onChange={(e) => updateRow(index, "composition", e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Qty *</label>
                  <input type="number" min="1" value={row.quantity} onChange={(e) => updateRow(index, "quantity", e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Rate *</label>
                  <input type="number" min="0" step="0.01" value={row.rate} onChange={(e) => updateRow(index, "rate", e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Taxable</label>
                  <input type="number" min="0" step="0.01" value={row.taxableAmount} onChange={(e) => updateRow(index, "taxableAmount", e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>GST %</label>
                  <input type="number" min="0" step="0.01" value={row.gstPercent} onChange={(e) => updateRow(index, "gstPercent", e.target.value)} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "110px 110px 110px 1fr", gap: "0.6rem", alignItems: "end" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>CGST Amt</label>
                  <input type="number" min="0" step="0.01" value={row.cgstAmount} onChange={(e) => updateRow(index, "cgstAmount", e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>SGST Amt</label>
                  <input type="number" min="0" step="0.01" value={row.sgstAmount} onChange={(e) => updateRow(index, "sgstAmount", e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>IGST Amt</label>
                  <input type="number" min="0" step="0.01" value={row.igstAmount} onChange={(e) => updateRow(index, "igstAmount", e.target.value)} />
                </div>
                <div style={{ textAlign: "right", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  Return value used for adjustment:
                  <div style={{ marginTop: 4, fontFamily: "monospace", fontWeight: 700, color: "#fb923c" }}>{fmt(lineAmount)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button onClick={addRow} className="btn btn-secondary">+ Add Product</button>
          <button onClick={submit} disabled={saving} className="btn btn-primary">
            {saving ? "Saving..." : "Record Credit Note"}
          </button>
        </div>
        <div style={{
          minWidth: 220,
          padding: "0.7rem 1rem",
          borderRadius: 10,
          border: "1px solid rgba(251,146,60,0.2)",
          background: "rgba(251,146,60,0.08)",
          textAlign: "right",
        }}>
          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Credit Note Total</div>
          <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: "1rem", color: "#fb923c" }}>{fmt(totalAmount)}</div>
        </div>
      </div>
    </div>
  );
}
