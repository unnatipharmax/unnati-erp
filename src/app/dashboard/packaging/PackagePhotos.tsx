"use client";

import { useRef, useState } from "react";

type Props = {
  onWeightExtracted: (netWeight: number) => void;
};

function UploadZone({
  label,
  icon,
  preview,
  onFile,
  badge,
  accent,
}: {
  label: string;
  icon: string;
  preview: string | null;
  onFile: (file: File) => void;
  badge?: React.ReactNode;
  accent: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: "0.73rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {icon} {label}
      </div>
      <div
        onClick={() => ref.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        style={{
          border: `2px dashed ${preview ? accent : "var(--border)"}`,
          borderRadius: 10,
          background: preview ? `${accent}0d` : "var(--surface-2)",
          cursor: "pointer",
          overflow: "hidden",
          minHeight: 130,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.18s",
          position: "relative",
        }}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt={label}
              style={{ width: "100%", height: 130, objectFit: "cover", display: "block" }}
            />
            {badge && (
              <div style={{ position: "absolute", bottom: 6, left: 6 }}>{badge}</div>
            )}
            <div style={{
              position: "absolute", top: 4, right: 4,
              background: "rgba(0,0,0,0.55)", color: "#fff",
              fontSize: "0.65rem", borderRadius: 4, padding: "2px 6px", cursor: "pointer",
            }}>
              Change
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "1rem", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "1.6rem", marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600 }}>Drop image or tap</div>
            <div style={{ fontSize: "0.68rem", marginTop: 2 }}>JPG · PNG · WEBP</div>
          </div>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

export default function PackagePhotos({ onWeightExtracted }: Props) {
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [scalePreview, setScalePreview]     = useState<string | null>(null);
  const [extracting, setExtracting]         = useState(false);
  const [extractedWeight, setExtractedWeight] = useState<number | null>(null);
  const [extractErr, setExtractErr]         = useState("");

  function readFile(file: File): Promise<{ base64: string; dataUrl: string; mime: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        resolve({ base64, dataUrl, mime: file.type || "image/jpeg" });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleProductFile(file: File) {
    const { dataUrl } = await readFile(file);
    setProductPreview(dataUrl);
  }

  async function handleScaleFile(file: File) {
    const { base64, dataUrl, mime } = await readFile(file);
    setScalePreview(dataUrl);
    setExtractedWeight(null);
    setExtractErr("");
    setExtracting(true);
    try {
      const res = await fetch("/api/packaging/extract-weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: mime }),
      });
      const data = await res.json();
      if (!res.ok) { setExtractErr(data?.error || "Extraction failed"); }
      else if (data.netWeight != null) {
        setExtractedWeight(data.netWeight);
        onWeightExtracted(data.netWeight);
      } else {
        setExtractErr("Could not read weight — enter manually below");
      }
    } catch {
      setExtractErr("Network error during extraction");
    }
    setExtracting(false);
  }

  const weightBadge = extracting ? (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "rgba(0,0,0,0.72)", color: "#fff",
      fontSize: "0.7rem", borderRadius: 6, padding: "3px 8px",
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      </svg>
      Reading scale…
    </span>
  ) : extractedWeight != null ? (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "rgba(16,185,129,0.85)", color: "#fff",
      fontSize: "0.72rem", fontWeight: 700, borderRadius: 6, padding: "3px 8px",
    }}>
      ✓ {extractedWeight} kg
    </span>
  ) : extractErr ? (
    <span style={{
      background: "rgba(239,68,68,0.8)", color: "#fff",
      fontSize: "0.68rem", borderRadius: 6, padding: "3px 8px",
    }}>
      ✕ {extractErr}
    </span>
  ) : null;

  return (
    <div style={{
      marginTop: "1rem",
      padding: "0.875rem 1rem",
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: 12,
    }}>
      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10 }}>
        📷 Package Photos
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <UploadZone
          label="Packed Products"
          icon="📦"
          preview={productPreview}
          onFile={handleProductFile}
          accent="#6366f1"
        />
        <UploadZone
          label="Box on Scale"
          icon="⚖️"
          preview={scalePreview}
          onFile={handleScaleFile}
          badge={weightBadge}
          accent="#10b981"
        />
      </div>

      {extractedWeight != null && (
        <div style={{
          marginTop: 8,
          fontSize: "0.78rem",
          color: "#10b981",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <span>✓ Weight auto-filled:</span>
          <strong>{extractedWeight} kg</strong>
          <span style={{ color: "var(--text-muted)" }}>· Adjust in the weight fields below if needed</span>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
