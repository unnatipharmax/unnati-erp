"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  async function handleLogin() {
    if (!username || !password) { setErr("Enter username and password"); return; }
    setLoading(true); setErr(null);
    const res  = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data?.error || "Login failed"); setLoading(false); }
    else router.push("/dashboard");
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--background)", padding: "1rem",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo / Title */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            width: 72, height: 72, borderRadius: 18,
            background: "var(--brand-soft)", border: "1px solid rgba(229,152,26,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem", padding: 12,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Unnati Pharmax" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>Unnati Pharmax</h1>
          <p style={{ fontSize: "0.875rem" }}>Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="card">
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                Username
              </label>
              <input
                autoFocus
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="Enter your username"
                autoComplete="username"
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            {err && (
              <div className="alert alert-error">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
                </svg>
                {err}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.75rem", fontSize: "0.9375rem" }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Signing in…
                </span>
              ) : "Sign In"}
            </button>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Unnati Pharmax ERP · Secure Access
        </p>
      </div>
    </div>
  );
}