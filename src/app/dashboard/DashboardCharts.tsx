"use client";
import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Dependency-free SVG chart components for the dashboard.
// Each chart is self-contained, responsive (viewBox-based), and interactive.
// ─────────────────────────────────────────────────────────────────────────────

// ── Area / Line chart with series toggle + hover crosshair ───────────────────
type SeriesPoint = { label: string; revenue: number; orders: number };

export function RevenueAreaChart({ data }: { data: SeriesPoint[] }) {
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0)
    return <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", padding: "1rem 0" }}>No data yet.</div>;

  const W = 720, H = 220, padL = 8, padR = 8, padT = 16, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const vals = data.map(d => (metric === "revenue" ? d.revenue : d.orders));
  const maxV = Math.max(...vals, 1);

  const n = data.length;
  const x = (i: number) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / maxV) * innerH;

  // smooth-ish path using simple line segments (clean + predictable)
  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(vals[i]).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${x(n - 1).toFixed(1)} ${padT + innerH} L ${x(0).toFixed(1)} ${padT + innerH} Z`;

  const accent = metric === "revenue" ? "#f3b942" : "#2563c9";
  const accentDark = metric === "revenue" ? "#c9820f" : "#1d4ed8";

  const fmtMonth = (s: string) => {
    const [yy, mm] = s.split("-");
    return new Date(Number(yy), Number(mm) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  };
  const fmtVal = (v: number) =>
    metric === "revenue"
      ? "$" + (v >= 1000 ? (v / 1000).toFixed(1) + "K" : v.toFixed(0))
      : v.toLocaleString();

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {(["revenue", "orders"] as const).map(m => (
          <button key={m} onClick={() => setMetric(m)} style={{
            padding: "3px 12px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 600, cursor: "pointer",
            border: `1px solid ${metric === m ? accent : "var(--border)"}`,
            background: metric === m ? `${accent}1f` : "transparent",
            color: metric === m ? accentDark : "var(--text-muted)", transition: "all 0.2s",
          }}>{m === "revenue" ? "Revenue" : "Orders"}</button>
        ))}
      </div>

      <div style={{ position: "relative", width: "100%" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
          onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id={`area-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.45" />
              <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* horizontal gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map(g => (
            <line key={g} x1={padL} x2={W - padR} y1={padT + innerH - g * innerH} y2={padT + innerH - g * innerH}
              stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" opacity="0.5" />
          ))}

          <path d={areaPath} fill={`url(#area-${metric})`} />
          <path d={linePath} fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

          {/* points + hover hit areas */}
          {data.map((d, i) => (
            <g key={d.label}>
              <circle cx={x(i)} cy={y(vals[i])} r={hover === i ? 5 : 3} fill="#fff" stroke={accent} strokeWidth="2.5"
                style={{ transition: "r 0.15s" }} />
              <rect x={x(i) - innerW / (2 * Math.max(1, n - 1))} y={padT} width={innerW / Math.max(1, n - 1)} height={innerH}
                fill="transparent" onMouseEnter={() => setHover(i)} style={{ cursor: "pointer" }} />
              {(i === 0 || i === n - 1 || i % Math.ceil(n / 7) === 0) && (
                <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{fmtMonth(d.label)}</text>
              )}
            </g>
          ))}

          {/* hover crosshair */}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + innerH} stroke={accent} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
          )}
        </svg>

        {hover !== null && (
          <div style={{
            position: "absolute", top: 0, left: `${(x(hover) / W) * 100}%`, transform: "translateX(-50%)",
            background: "var(--surface-1)", border: `1px solid ${accent}`, borderRadius: 8,
            padding: "5px 10px", fontSize: "0.72rem", pointerEvents: "none", whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 2,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{fmtMonth(data[hover].label)}</div>
            <div style={{ color: accentDark, fontFamily: "monospace", fontWeight: 700 }}>{fmtVal(vals[hover])}</div>
            <div style={{ color: "var(--text-muted)" }}>
              {metric === "revenue" ? `${data[hover].orders} orders` : `$${data[hover].revenue >= 1000 ? (data[hover].revenue / 1000).toFixed(1) + "K" : data[hover].revenue.toFixed(0)}`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Donut chart with center total + interactive legend ───────────────────────
type DonutSlice = { label: string; value: number; color: string; sub?: string };

export function DonutChart({ slices, centerLabel, centerValue }: { slices: DonutSlice[]; centerLabel: string; centerValue: string }) {
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce((s, d) => s + d.value, 0);

  if (total === 0)
    return <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", padding: "1rem 0" }}>No data yet.</div>;

  const R = 80, r = 52, cx = 100, cy = 100;
  let acc = 0;
  const arcs = slices.map((s, i) => {
    const start = (acc / total) * 2 * Math.PI - Math.PI / 2;
    acc += s.value;
    const end = (acc / total) * 2 * Math.PI - Math.PI / 2;
    const large = end - start > Math.PI ? 1 : 0;
    const grow = active === i ? 6 : 0;
    const oR = R + grow;
    const x1 = cx + oR * Math.cos(start), y1 = cy + oR * Math.sin(start);
    const x2 = cx + oR * Math.cos(end), y2 = cy + oR * Math.sin(end);
    const xi1 = cx + r * Math.cos(end), yi1 = cy + r * Math.sin(end);
    const xi2 = cx + r * Math.cos(start), yi2 = cy + r * Math.sin(start);
    const d = `M ${x1} ${y1} A ${oR} ${oR} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${r} ${r} 0 ${large} 0 ${xi2} ${yi2} Z`;
    return { d, color: s.color, i };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
      <svg viewBox="0 0 200 200" style={{ width: 160, height: 160, flexShrink: 0 }}>
        {arcs.map(a => (
          <path key={a.i} d={a.d} fill={a.color}
            opacity={active === null || active === a.i ? 1 : 0.35}
            onMouseEnter={() => setActive(a.i)} onMouseLeave={() => setActive(null)}
            style={{ cursor: "pointer", transition: "opacity 0.2s" }} />
        ))}
        <text x="100" y="94" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text-primary, #111)">
          {active !== null ? `${Math.round((slices[active].value / total) * 100)}%` : centerValue}
        </text>
        <text x="100" y="112" textAnchor="middle" fontSize="9" fill="var(--text-muted)">
          {active !== null ? slices[active].label : centerLabel}
        </text>
      </svg>

      <div style={{ flex: 1, minWidth: 140 }}>
        {slices.map((s, i) => (
          <div key={s.label} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "3px 6px", borderRadius: 6, cursor: "pointer",
              background: active === i ? "var(--surface-2)" : "transparent", transition: "background 0.15s",
            }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: "0.78rem", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
            <span style={{ fontSize: "0.72rem", fontFamily: "monospace", color: "var(--text-muted)" }}>
              {Math.round((s.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Radial progress gauge ────────────────────────────────────────────────────
export function RadialGauge({ value, max, label, sublabel, color }: { value: number; max: number; label: string; sublabel: string; color: string }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const R = 52, circ = 2 * Math.PI * R;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg viewBox="0 0 140 140" style={{ width: 130, height: 130 }}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
        <circle cx="70" cy="70" r={R} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }} />
        <text x="70" y="68" textAnchor="middle" fontSize="22" fontWeight="800" fill={color}>{Math.round(pct * 100)}%</text>
        <text x="70" y="86" textAnchor="middle" fontSize="9" fill="var(--text-muted)">{label}</text>
      </svg>
      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "center" }}>{sublabel}</div>
    </div>
  );
}

// ── Horizontal stacked bar (composition in one row) ──────────────────────────
export function StackedBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  const [active, setActive] = useState<number | null>(null);
  if (total === 0) return <div style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>No data.</div>;
  return (
    <div>
      <div style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
        {segments.map((s, i) => s.value > 0 && (
          <div key={s.label} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
            title={`${s.label}: ${s.value}`}
            style={{
              width: `${(s.value / total) * 100}%`, background: s.color, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.7rem", fontWeight: 700, color: "#fff",
              opacity: active === null || active === i ? 1 : 0.4, transition: "opacity 0.2s",
            }}>
            {(s.value / total) > 0.08 ? s.value : ""}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem 1rem" }}>
        {segments.map((s, i) => (
          <div key={s.label} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.74rem", cursor: "pointer", opacity: active === null || active === i ? 1 : 0.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color }} />
            <span style={{ color: "var(--text-secondary)" }}>{s.label}</span>
            <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
