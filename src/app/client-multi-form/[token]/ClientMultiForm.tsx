"use client";

import { useRef, useMemo, useState } from "react";

export default function ClientMultiForm({
  token,
  accountName,
  balance,
}: {
  token: string;
  accountId: string;
  accountName: string;
  balance: number;
}) {
  const formRef                     = useRef<HTMLFormElement>(null);
  const [loading, setLoading]       = useState(false);
  const [submitted, setSubmitted]   = useState(false); // blocks double submit
  const [ok, setOk]                 = useState<{ orderId: string } | null>(null);
  const [err, setErr]               = useState<string | null>(null);

  const shortOrder = useMemo(() => {
    if (!ok?.orderId) return "";
    return ok.orderId.split("-")[0].toUpperCase();
  }, [ok]);

  const exhausted = balance <= 0;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (exhausted || submitted) return; // prevent double submit

    setLoading(true);
    setSubmitted(true); // lock immediately
    setErr(null);

    const form = new FormData(e.currentTarget);
    form.set("token", token);
    if (!String(form.get("remitterName") ?? "").trim()) {
      form.set("remitterName", accountName);
    }
    if (!String(form.get("currency") ?? "").trim()) {
      form.set("currency", "INR");
    }

    const res  = await fetch("/api/client-multi-form-submit", {
      method:  "POST",
      body:    form,
    });
    const data = await res.json();

    if (!res.ok) {
      setErr(data?.error || "Something went wrong");
      setSubmitted(false); // allow retry on error
    } else {
      setOk({ orderId: data.orderId });
      formRef.current?.reset();
    }

    setLoading(false);
  }

  function handleSubmitAnother() {
    setOk(null);
    setSubmitted(false);
    setErr(null);
  }

  return (
    <div style={{
      minHeight: "100vh", background: "var(--background)", color: "var(--text-primary)",
      display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "2rem 1rem",
    }}>
      <div style={{ width: "100%", maxWidth: 820 }}>
        {/* Brand header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.25rem" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Unnati Pharmax" style={{ width: 40, height: 40, objectFit: "contain" }} />
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>UNNATI PHARMAX</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Multi Order Form</div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ margin: 0 }}>Client Multi Order Form</h2>
          <p style={{ marginTop: 4, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Account: <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{accountName}</span>
          </p>
          <p style={{ marginTop: 2, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Available Balance:{" "}
            <span style={{ fontWeight: 700, color: exhausted ? "#dc2626" : "#047857" }}>
              ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </p>

          {exhausted && (
            <div className="alert alert-error" style={{ marginTop: "1rem", flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ fontWeight: 700 }}>❌ Balance exhausted</div>
              <div style={{ fontSize: "0.85rem", marginTop: 2 }}>
                Please contact the accounts team to add funds.
              </div>
            </div>
          )}

          {/* Success box */}
          {ok && (
            <div className="alert alert-success" style={{ marginTop: "1.25rem", flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ fontWeight: 700 }}>✅ Order Created</div>
              <div style={{ fontSize: "0.85rem", marginTop: 2 }}>
                Order: <span style={{ fontWeight: 700 }}>#{shortOrder}</span>
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4, wordBreak: "break-all" }}>
                Internal ID: {ok.orderId}
              </div>
              <button
                onClick={handleSubmitAnother}
                className="btn btn-secondary btn-sm"
                style={{ marginTop: "0.75rem" }}
              >
                Submit another order →
              </button>
            </div>
          )}

          <form ref={formRef} onSubmit={onSubmit} style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <fieldset
              disabled={loading || exhausted || !!ok}
              style={{ border: "none", padding: 0, margin: 0, opacity: (exhausted || !!ok) ? 0.6 : 1, display: "flex", flexDirection: "column", gap: "1.5rem" }}
            >
              <Section title="Customer Details">
                <Grid>
                  <Field label="Customer Full Name"><Input name="fullName" placeholder="Customer Full Name" required /></Field>
                  <Field label="Customer Email"><Input name="email" placeholder="Email" type="email" required /></Field>
                  <Field label="Customer Phone"><Input name="phone" placeholder="Phone" required /></Field>
                </Grid>
              </Section>

              <Section title="Delivery Address">
                <Grid>
                  <Field label="Address"><Input name="address" placeholder="Address" required /></Field>
                  <Field label="City"><Input name="city" placeholder="City" required /></Field>
                  <Field label="State"><Input name="state" placeholder="State" required /></Field>
                  <Field label="Postal Code"><Input name="postalCode" placeholder="Postal Code" required /></Field>
                  <Field label="Country"><Input name="country" placeholder="Country" required /></Field>
                </Grid>
              </Section>

              <Section title="Order Amount">
                <Grid>
                  <Field label="Amount"><Input name="amountPaid" placeholder="0.00" type="number" min="0" step="0.01" required /></Field>
                  <Field label="Currency"><Input name="currency" placeholder="INR" defaultValue="INR" required /></Field>
                </Grid>
              </Section>

              <Section title="Meta (Optional)">
                <Grid>
                  <Field label="Remitter Name (optional)"><Input name="remitterName" placeholder={accountName} /></Field>
                  <Field label="Upload Prescription (optional)">
                    <Input name="prescription" type="file" accept=".pdf,image/jpeg,image/png,image/webp" />
                  </Field>
                </Grid>
              </Section>
            </fieldset>

            {!ok && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <button disabled={loading || exhausted} type="submit" className="btn btn-primary">
                  {loading ? "Submitting…" : "Submit Order"}
                </button>
                {err && <p style={{ fontSize: "0.85rem", color: "#b91c1c", margin: 0 }}>{err}</p>}
              </div>
            )}
          </form>
        </div>

        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "1rem", textAlign: "center" }}>
          This is a permanent multi-order link for this account.
        </p>
      </div>
    </div>
  );
}

/* ---------- tiny UI helpers (match single client form theme) ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent)", marginBottom: "0.75rem" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 500 }}>{label}</span>
      <div style={{ marginTop: 4 }}>{children}</div>
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}
