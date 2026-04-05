"use client";
import { useState, useEffect, useCallback } from "react";

type BackupFile = {
  filename: string;
  date: string;
  sizeMB: number;
  createdAt: string;
};

export default function ReportsClient({ isAdmin }: { isAdmin: boolean }) {
  const [backups, setBackups]         = useState<BackupFile[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [runningBackup, setRunningBackup]   = useState(false);
  const [backupMsg, setBackupMsg]     = useState("");
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);

  const fetchBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch("/api/backup");
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups ?? []);
      }
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  useEffect(() => { fetchBackups(); }, [fetchBackups]);

  async function runBackup() {
    setRunningBackup(true);
    setBackupMsg("");
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setBackupMsg(`✓ Backup created: ${data.filename} (${data.sizeMB} MB). Deleted ${data.deletedOld?.length ?? 0} old backup(s).`);
        fetchBackups();
      } else {
        setBackupMsg("✗ Backup failed: " + (data.error ?? "Unknown error"));
      }
    } catch (e) {
      setBackupMsg("✗ Network error");
    } finally {
      setRunningBackup(false);
    }
  }

  async function deleteBackup(filename: string) {
    if (!confirm(`Delete backup ${filename}?`)) return;
    setDeletingFile(filename);
    try {
      const res = await fetch("/api/backup", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      if (res.ok) fetchBackups();
    } finally {
      setDeletingFile(null);
    }
  }

  async function downloadExcel() {
    setExportingExcel(true);
    try {
      const res = await fetch("/api/export/master");
      if (!res.ok) { alert("Export failed"); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `UnnatiPharmax_MasterData_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingExcel(false);
    }
  }

  const card: React.CSSProperties = {
    background: "#fff",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    padding: "1.5rem",
    marginBottom: "1.5rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  };

  const btnPrimary: React.CSSProperties = {
    padding: "9px 20px",
    background: "#1a3a6b",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "0.92rem",
  };

  const btnGold: React.CSSProperties = {
    ...btnPrimary,
    background: "#c8960c",
  };

  const btnDanger: React.CSSProperties = {
    ...btnPrimary,
    background: "#dc2626",
    padding: "5px 12px",
    fontSize: "0.8rem",
  };

  return (
    <div style={{ padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.25rem" }}>
        Reports &amp; Data Backup
      </h1>
      <p style={{ color: "#666", marginBottom: "2rem", fontSize: "0.92rem" }}>
        Export all ERP data to Excel or manage daily JSON backups (last 30 days retained automatically).
      </p>

      {/* ── Excel Export ── */}
      <div style={card}>
        <h2 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.5rem" }}>
          📊 Master Excel Export
        </h2>
        <p style={{ color: "#555", fontSize: "0.88rem", marginBottom: "1rem" }}>
          Downloads a multi-sheet Excel workbook with: Orders, Order Items, Products, Purchase Bills,
          Purchase Items, Clients, Ledger, Expenses, Suppliers, Supplier Payments, Export Returns.
        </p>
        <button style={btnGold} onClick={downloadExcel} disabled={exportingExcel}>
          {exportingExcel ? "Generating…" : "⬇ Download Excel Master Sheet"}
        </button>
      </div>

      {/* ── Backup Management (Admin/Manager only) ── */}
      {isAdmin && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <h2 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.25rem" }}>
                🗄️ Database Backups
              </h2>
              <p style={{ color: "#555", fontSize: "0.88rem" }}>
                Full JSON snapshot of all database tables. Auto-runs daily at 2 AM (Vercel cron).
                Only the last 30 backups are kept — older ones are deleted automatically.
              </p>
            </div>
            <button style={btnPrimary} onClick={runBackup} disabled={runningBackup}>
              {runningBackup ? "Backing up…" : "▶ Run Backup Now"}
            </button>
          </div>

          {backupMsg && (
            <div style={{
              padding: "10px 14px",
              borderRadius: 7,
              background: backupMsg.startsWith("✓") ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${backupMsg.startsWith("✓") ? "#86efac" : "#fca5a5"}`,
              color: backupMsg.startsWith("✓") ? "#166534" : "#991b1b",
              marginBottom: "1rem",
              fontSize: "0.88rem",
              fontWeight: 600,
            }}>
              {backupMsg}
            </div>
          )}

          {/* Info box */}
          <div style={{
            background: "#fffbeb",
            border: "1px solid #e8d080",
            borderRadius: 7,
            padding: "10px 14px",
            fontSize: "0.82rem",
            color: "#7a5c00",
            marginBottom: "1rem",
          }}>
            <b>Backup location:</b> <code>/backups/backup-YYYY-MM-DD.json</code> in the project root.
            &nbsp;For Windows local backup without Vercel, run a Windows Task Scheduler task daily calling:
            <br /><code>curl -X POST http://localhost:3000/api/backup</code>
          </div>

          {/* Backup list */}
          {loadingBackups ? (
            <p style={{ color: "#888", fontSize: "0.88rem" }}>Loading backup list…</p>
          ) : backups.length === 0 ? (
            <p style={{ color: "#888", fontSize: "0.88rem" }}>No backups yet. Click "Run Backup Now" to create the first one.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ background: "#f4f7fb" }}>
                  {["Date", "File", "Size", "Created At", ""].map(h => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backups.map((b, i) => (
                  <tr key={b.filename} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                    <td style={{ padding: "7px 10px", fontWeight: 700 }}>{b.date}</td>
                    <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "#444" }}>{b.filename}</td>
                    <td style={{ padding: "7px 10px", color: "#555" }}>{b.sizeMB} MB</td>
                    <td style={{ padding: "7px 10px", color: "#888" }}>
                      {new Date(b.createdAt).toLocaleString("en-IN")}
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <button
                        style={btnDanger}
                        disabled={deletingFile === b.filename}
                        onClick={() => deleteBackup(b.filename)}
                      >
                        {deletingFile === b.filename ? "…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "#999" }}>
            {backups.length} / 30 backup slots used.
            {backups.length >= 30 && " ⚠ At capacity — oldest will be deleted on next backup."}
          </p>
        </div>
      )}

      {/* ── Schedule Info ── */}
      <div style={{ ...card, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <h2 style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.75rem" }}>
          ⏰ Backup Schedule
        </h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
          <tbody>
            {[
              ["Frequency", "Daily (every day at 2:00 AM UTC)"],
              ["Trigger", "Vercel Cron → /api/backup/cron"],
              ["Retention", "Last 30 days (older backups auto-deleted)"],
              ["Format", "JSON snapshot of all database tables"],
              ["Local alternative", "Windows Task Scheduler → curl -X POST http://localhost:3000/api/backup"],
              ["Excel export", "On-demand via this page (no schedule)"],
            ].map(([label, value]) => (
              <tr key={label} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "7px 10px", fontWeight: 700, color: "#374151", width: 200 }}>{label}</td>
                <td style={{ padding: "7px 10px", color: "#555", fontFamily: label.includes("alternative") || label.includes("Trigger") ? "monospace" : undefined }}>
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
