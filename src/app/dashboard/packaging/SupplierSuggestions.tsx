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
        <button onClick={onProceedToUpload} className="btn btn-primary btn-sm" style={{ fontSize: "0.78rem" }}>
          + Upload New Bill
        </button>
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
        borderTop: "1px solid rgba(255,255,255,0.06)",
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
