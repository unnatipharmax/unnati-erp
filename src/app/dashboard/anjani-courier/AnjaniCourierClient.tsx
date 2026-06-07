"use client";

import { useRef, useState } from "react";

type Row = {
  id: string;
  date: string;        // yyyy-mm-dd
  party: string;
  trackingNo: string;
  weight: string;      // kg (string for editing)
  thumb?: string;      // preview data url
  reading?: boolean;   // AI in progress
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB");
}
function money(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const uid = () => Math.random().toString(36).slice(2);

export default function AnjaniCourierClient() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows]   = useState<Row[]>([]);
  const [pricePerKg, setPricePerKg] = useState("");
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState("");

  const rate = parseFloat(pricePerKg) || 0;
  const totalWeight = rows.reduce((s, r) => s + (parseFloat(r.weight) || 0), 0);
  const totalAmount = rows.reduce((s, r) => s + (parseFloat(r.weight) || 0) * rate, 0);

  function setCell(id: string, key: keyof Row, val: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: val } : r));
  }
  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id));
  }
  function addBlank() {
    setRows(prev => [...prev, { id: uid(), date: todayISO(), party: "", trackingNo: "", weight: "" }]);
  }

  function readFile(file: File): Promise<{ dataUrl: string; base64: string; mime: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target?.result as string;
        resolve({ dataUrl, base64: dataUrl.split(",")[1], mime: file.type || "image/jpeg" });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFiles(files: FileList) {
    setErr(""); setBusy(true);
    for (const file of Array.from(files)) {
      const id = uid();
      const { dataUrl, base64, mime } = await readFile(file);
      // Add a placeholder row immediately
      setRows(prev => [...prev, { id, date: todayISO(), party: "", trackingNo: "", weight: "", thumb: dataUrl, reading: true }]);
      try {
        const res = await fetch("/api/anjani/extract", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType: mime }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErr(data?.error || "Extraction failed for one image");
          setRows(prev => prev.map(r => r.id === id ? { ...r, reading: false } : r));
        } else {
          setRows(prev => prev.map(r => r.id === id ? {
            ...r,
            party: data.partyName ?? "",
            trackingNo: data.trackingNo ?? "",
            weight: data.weight != null ? String(data.weight) : "",
            reading: false,
          } : r));
        }
      } catch {
        setErr("Network error during extraction");
        setRows(prev => prev.map(r => r.id === id ? { ...r, reading: false } : r));
      }
    }
    setBusy(false);
  }

  function downloadCSV() {
    const header = ["Date", "Tracking No", "Party Name", "Weight (kg)", "Amount"];
    const lines = rows.map(r => {
      const amt = (parseFloat(r.weight) || 0) * rate;
      return [fmtDate(r.date), r.trackingNo, r.party, (parseFloat(r.weight) || 0).toFixed(2), amt.toFixed(2)]
        .map(c => `"${String(c).replace(/"/g, '""')}"`).join(",");
    });
    lines.push(["", "", "TOTAL", totalWeight.toFixed(2), totalAmount.toFixed(2)].map(c => `"${c}"`).join(","));
    const csv = [header.map(h => `"${h}"`).join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `anjani-courier-${todayISO()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const cellInput: React.CSSProperties = {
    width: "100%", border: "1px solid transparent", background: "transparent",
    padding: "5px 6px", fontSize: "0.82rem", borderRadius: 4, outline: "none",
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Anjani Courier</h1>
          <p className="text-sm text-slate-500 mt-1">
            Upload each consolidated packet&apos;s courier label — weight, tracking no and party are read automatically.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn btn-primary btn-sm">
            {busy ? "Reading…" : "＋ Upload Package Label"}
          </button>
          <button onClick={downloadCSV} disabled={rows.length === 0} className="btn btn-secondary btn-sm">⬇ Download Sheet</button>
        </div>
        <input
          ref={fileRef} type="file" accept="image/*" capture="environment" multiple
          style={{ display: "none" }}
          onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {/* Controls */}
      <div className="flex gap-3 flex-wrap mb-4 items-end">
        <label className="block">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Price per kg (₹)</span>
          <input
            type="number" value={pricePerKg} onChange={e => setPricePerKg(e.target.value)}
            placeholder="e.g. 40" min="0" step="0.01"
            className="mt-1 w-36 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
        </label>
        <button onClick={addBlank} className="btn btn-secondary btn-sm" style={{ marginBottom: 2 }}>+ Add Row Manually</button>
      </div>

      {err && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{err}</div>}

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "5%" }} /><col style={{ width: "9%" }} /><col style={{ width: "16%" }} />
            <col style={{ width: "28%" }} /><col style={{ width: "13%" }} /><col style={{ width: "15%" }} />
            <col style={{ width: "9%" }} /><col style={{ width: "5%" }} />
          </colgroup>
          <thead>
            <tr className="bg-slate-100 text-slate-500 text-xs uppercase tracking-wide">
              <th className="px-3 py-3 text-left font-medium">#</th>
              <th className="px-3 py-3 text-left font-medium">Photo</th>
              <th className="px-3 py-3 text-left font-medium">Date</th>
              <th className="px-3 py-3 text-left font-medium">Party Name</th>
              <th className="px-3 py-3 text-left font-medium">Tracking No</th>
              <th className="px-3 py-3 text-right font-medium">Weight (kg)</th>
              <th className="px-3 py-3 text-right font-medium">Amount (₹)</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                No packets yet. Click <b>Upload Package Label</b> to read a courier label, or add a row manually.
              </td></tr>
            ) : rows.map((r, idx) => {
              const amt = (parseFloat(r.weight) || 0) * rate;
              return (
                <tr key={r.id} className="border-t border-slate-200">
                  <td className="px-3 py-2 text-slate-400 tabular-nums">{idx + 1}</td>
                  <td className="px-3 py-2">
                    {r.thumb
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={r.thumb} alt="label" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }} />
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td><input type="date" value={r.date} onChange={e => setCell(r.id, "date", e.target.value)} style={cellInput} /></td>
                  <td>
                    {r.reading
                      ? <span className="text-amber-600 text-xs px-2">Reading label…</span>
                      : <input value={r.party} onChange={e => setCell(r.id, "party", e.target.value)} placeholder="Party name" style={cellInput} />}
                  </td>
                  <td><input value={r.trackingNo} onChange={e => setCell(r.id, "trackingNo", e.target.value)} placeholder="Tracking no" style={{ ...cellInput, fontFamily: "monospace" }} /></td>
                  <td><input type="number" value={r.weight} onChange={e => setCell(r.id, "weight", e.target.value)} placeholder="0.00" style={{ ...cellInput, textAlign: "right" }} /></td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                    {r.weight && rate > 0 ? `₹${money(amt)}` : "—"}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => removeRow(r.id)} title="Remove"
                      className="w-6 h-6 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50">✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                <td className="px-3 py-3" colSpan={5}>TOTAL · {rows.length} packets</td>
                <td className="px-3 py-3 text-right tabular-nums">{totalWeight.toFixed(2)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{rate > 0 ? `₹${money(totalAmount)}` : "—"}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Each uploaded label becomes a row. The AI reads party, tracking number and weight — edit any cell if needed, set price per kg, then download the sheet.
      </p>
    </div>
  );
}
