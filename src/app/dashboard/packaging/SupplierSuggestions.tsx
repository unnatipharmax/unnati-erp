"use client";

import { useEffect, useState } from "react";

type Supplier = {
  partyId: string;
  partyName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  bestRate: number;
  bestQty: number;
  lastDate: string | null;
  invoiceNo: string | null;
};

type ProductEntry = {
  productId: string;
  productName: string;
  neededQty: number;
  stockQty: number | null;
};

type SupplierMap = Record<string, Supplier[]>;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)
  );
}

export default function SupplierSuggestions({
  outOfStockItems,
  onProceedToUpload,
}: {
  outOfStockItems: ProductEntry[];
  onProceedToUpload: () => void;
}) {
  const [map, setMap] = useState<SupplierMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (outOfStockItems.length === 0) { setLoading(false); return; }
    const ids = outOfStockItems.map((i) => i.productId).join(",");
    fetch(`/api/packaging/product-suppliers?productIds=${encodeURIComponent(ids)}`)
      .then((r) => r.json())
      .then((data) => { setMap(data); setLoading(false); })
      .catch(() => { setErr("Failed to load supplier data"); setLoading(false); });
  }, [outOfStockItems.map((i) => i.productId).join(",")]);

  if (loading) {
    return (
      <div style={{
        marginTop: "1rem", padding: "1rem 1.25rem",
        background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.18)",
        borderRadius: 12, display: "flex", alignItems: "center", gap: 10,
        fontSize: "0.82rem", color: "var(--text-secondary)",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        </svg>
        Looking up past suppliers…
      </div>
    );
  }

  if (err) {
    return (
      <div style={{ marginTop: "1rem" }}>
        <div className="alert alert-error" style={{ fontSize: "0.8rem" }}>{err}</div>
        <button onClick={onProceedToUpload} className="btn btn-secondary btn-sm" style={{ marginTop: "0.5rem" }}>
          Upload New Bill
        </button>
      </div>
    );
  }

  const hasSuppliersForAny = outOfStockItems.some(
    (item) => (map?.[item.productId]?.length ?? 0) > 0
  );

  // Build the reorder rows: product, qty to order, cheapest supplier (lowest past price)
  function buildOrderRows() {
    return outOfStockItems.map((item) => {
      const qtyToOrder = item.stockQty != null && item.stockQty > 0
        ? item.neededQty - item.stockQty
        : item.neededQty;
      const cheapest = map?.[item.productId]?.[0] ?? null; // already sorted cheapest-first
      return {
        productName: item.productName,
        qtyToOrder,
        supplierName: cheapest?.partyName ?? "—",
        supplierPhone: cheapest?.phone ?? null,
        lastRate: cheapest?.bestRate ?? null,
      };
    });
  }

  function printOrderList() {
    const rows = buildOrderRows();
    const dateStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    const bodyRows = rows.map((r, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${escapeHtml(r.productName)}</td>
        <td style="text-align:center;font-weight:bold">${r.qtyToOrder}</td>
        <td>${escapeHtml(r.supplierName)}${r.supplierPhone ? ` <span style="color:#555;font-size:11px">(${escapeHtml(r.supplierPhone)})</span>` : ""}</td>
        <td style="text-align:right">${r.lastRate != null ? "&#8377;" + r.lastRate.toFixed(2) : "—"}</td>
        <td></td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Reorder List - ${dateStr}</title>
      <style>
        * { font-family: Arial, sans-serif; color:#000; box-sizing:border-box; }
        body { padding: 24px; }
        h1 { font-size: 18px; margin: 0 0 2px; letter-spacing: .04em; }
        .sub { font-size: 12px; color:#444; margin-bottom: 16px; }
        table { width:100%; border-collapse: collapse; }
        th, td { border:1px solid #000; padding:7px 9px; font-size:12px; vertical-align: top; }
        thead th { background:#e8e8e8; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.04em; }
        tfoot td { font-weight:bold; }
        .note { margin-top:18px; font-size:11px; color:#555; }
        @media print { body { padding: 0; } @page { margin: 14mm; } }
      </style></head>
      <body>
        <h1>UNNATI PHARMAX — REORDER LIST</h1>
        <div class="sub">Items to be procured &nbsp;·&nbsp; Generated ${dateStr}</div>
        <table>
          <thead>
            <tr>
              <th style="width:5%;text-align:center">#</th>
              <th style="width:34%">Product Name</th>
              <th style="width:12%;text-align:center">Qty to Order</th>
              <th style="width:28%">Supplier (lowest past price)</th>
              <th style="width:11%;text-align:right">Last Rate</th>
              <th style="width:10%">Done ✓</th>
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
        <div class="note">Supplier shown is the one from whom this product was last purchased at the lowest price. Confirm current rates before ordering.</div>
        <script>window.onload = function(){ window.print(); }</script>
      </body></html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { setErr("Pop-up blocked — allow pop-ups to print the order list."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return (
    <div style={{
      marginTop: "1rem",
      padding: "1rem 1.25rem",
      background: "rgba(245,158,11,0.05)",
      border: "1px solid rgba(245,158,11,0.2)",
      borderRadius: 12,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1rem" }}>📦</span>
          <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)" }}>
            Reorder Suggestions
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: 2 }}>
            ({outOfStockItems.length} item{outOfStockItems.length !== 1 ? "s" : ""} need ordering)
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button onClick={printOrderList} className="btn btn-secondary btn-sm" style={{ fontSize: "0.78rem" }}>
            🖨 Print Order List
          </button>
          <button onClick={onProceedToUpload} className="btn btn-primary btn-sm" style={{ fontSize: "0.78rem" }}>
            + Upload New Bill
          </button>
        </div>
      </div>

      {/* Per-product supplier cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {outOfStockItems.map((item) => {
          const suppliers = map?.[item.productId] ?? [];
          const shortage = item.stockQty != null && item.stockQty > 0
            ? item.neededQty - item.stockQty
            : item.neededQty;

          return (
            <div key={item.productId} style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              overflow: "hidden",
            }}>
              {/* Product header */}
              <div style={{
                padding: "0.5rem 0.875rem",
                borderBottom: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "var(--surface-2)",
              }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: "0.84rem" }}>{item.productName}</span>
                  {item.stockQty != null && item.stockQty > 0 ? (
                    <span style={{ marginLeft: 8, fontSize: "0.74rem", color: "#f97316", fontWeight: 600 }}>
                      Need {shortage} more (have {item.stockQty}, need {item.neededQty})
                    </span>
                  ) : (
                    <span style={{ marginLeft: 8, fontSize: "0.74rem", color: "#ef4444", fontWeight: 600 }}>
                      Need {item.neededQty} units — not in stock
                    </span>
                  )}
                </div>
              </div>

              {/* Supplier list */}
              {suppliers.length === 0 ? (
                <div style={{ padding: "0.6rem 0.875rem", fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                  No purchase history for this product — upload a new bill below.
                </div>
              ) : (
                <div>
                  {/* Column headers */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 90px 80px 120px",
                    gap: "0.4rem",
                    padding: "0.3rem 0.875rem",
                    fontSize: "0.68rem",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    borderBottom: "1px solid var(--border)",
                  }}>
                    <span>Supplier</span>
                    <span style={{ textAlign: "right" }}>Best Rate</span>
                    <span style={{ textAlign: "center" }}>Last Qty</span>
                    <span style={{ textAlign: "center" }}>Last Purchase</span>
                  </div>

                  {suppliers.map((sup, idx) => (
                    <div key={sup.partyId} style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 90px 80px 120px",
                      gap: "0.4rem",
                      padding: "0.45rem 0.875rem",
                      fontSize: "0.8rem",
                      borderBottom: idx < suppliers.length - 1 ? "1px solid rgba(255,255,255,0.04)" : undefined,
                      background: idx === 0 ? "rgba(16,185,129,0.05)" : undefined,
                      alignItems: "center",
                    }}>
                      {/* Supplier info */}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {idx === 0 && (
                            <span style={{
                              fontSize: "0.62rem", fontWeight: 700, padding: "1px 5px",
                              background: "rgba(16,185,129,0.15)", color: "#10b981",
                              border: "1px solid rgba(16,185,129,0.3)", borderRadius: 4,
                              whiteSpace: "nowrap",
                            }}>
                              Cheapest
                            </span>
                          )}
                          <span style={{ fontWeight: 600 }}>{sup.partyName}</span>
                        </div>
                        {(sup.phone || sup.email) && (
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 1 }}>
                            {sup.phone && <span>📞 {sup.phone}</span>}
                            {sup.phone && sup.email && <span> · </span>}
                            {sup.email && <span>✉ {sup.email}</span>}
                          </div>
                        )}
                        {sup.address && (
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 1 }}>{sup.address}</div>
                        )}
                      </div>

                      {/* Rate */}
                      <div style={{ textAlign: "right" }}>
                        <span style={{
                          fontFamily: "monospace", fontWeight: 700,
                          color: idx === 0 ? "#10b981" : "var(--text-primary)",
                          fontSize: "0.84rem",
                        }}>
                          ₹{sup.bestRate.toFixed(2)}
                        </span>
                        <div style={{ fontSize: "0.67rem", color: "var(--text-muted)" }}>/unit</div>
                      </div>

                      {/* Qty */}
                      <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "0.78rem" }}>
                        {sup.bestQty} units
                      </div>

                      {/* Date + invoice */}
                      <div style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {sup.lastDate
                          ? new Date(sup.lastDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })
                          : "—"}
                        {sup.invoiceNo && (
                          <div style={{ fontSize: "0.67rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                            {sup.invoiceNo}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer CTA */}
      <div style={{
        marginTop: "0.875rem",
        paddingTop: "0.875rem",
        borderTop: "1px solid rgba(0,0,0,0.05)",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        flexWrap: "wrap",
      }}>
        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
          {hasSuppliersForAny
            ? "Contact the cheapest supplier and upload the bill when received."
            : "No purchase history found — upload a new purchase bill below."}
        </span>
        <button onClick={onProceedToUpload} className="btn btn-primary btn-sm" style={{ fontSize: "0.78rem", marginLeft: "auto" }}>
          Upload Bill →
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
