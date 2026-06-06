"use client";

import { useMemo, useState } from "react";

const CURRENCIES = ["USD", "INR", "EUR", "GBP", "AUD", "CAD", "AED", "SGD", "JPY"];

export default function ClientForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<{ orderId: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isSubmitted = !!ok;

  const shortOrder = useMemo(() => {
    if (!ok?.orderId) return "";
    return ok.orderId.split("-")[0].toUpperCase();
  }, [ok]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitted) return;

    setLoading(true);
    setErr(null);

    const form = new FormData(e.currentTarget);
    form.set("token", token);

    const res = await fetch("/api/client-form-submit", {
      method: "POST",
      body: form,
    });

    const data = await res.json();

    if (!res.ok) {
      setErr(data?.error || "Something went wrong");
    } else {
      setOk({ orderId: data.orderId });
    }

    setLoading(false);
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
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Export Order Form</div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ margin: 0 }}>Client Order Form</h2>
          <p style={{ marginTop: 4, fontSize: "0.875rem" }}>Please fill all details carefully.</p>

          {/* Success box */}
          {ok && (
            <div className="alert alert-success" style={{ marginTop: "1.25rem", flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ fontWeight: 700 }}>✅ Submitted successfully</div>
              <div style={{ fontSize: "0.85rem", marginTop: 2 }}>
                Order: <span style={{ fontWeight: 700 }}>#{shortOrder}</span>
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4, wordBreak: "break-all" }}>
                Internal ID: {ok.orderId}
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <fieldset
              disabled={loading || isSubmitted}
              style={{ border: "none", padding: 0, margin: 0, opacity: isSubmitted ? 0.7 : 1, display: "flex", flexDirection: "column", gap: "1.5rem" }}
            >
              {/* Contact */}
              <Section title="Contact Details">
                <Grid>
                  <Field label="Full Name"><Input name="fullName" placeholder="Full Name" required /></Field>
                  <Field label="Email"><Input name="email" placeholder="Email" type="email" required /></Field>
                  <Field label="Phone"><Input name="phone" placeholder="Phone" required /></Field>
                </Grid>
              </Section>

              {/* Address */}
              <Section title="Address">
                <Grid>
                  <Field label="Address"><Input name="address" placeholder="Address" required /></Field>
                  <Field label="City"><Input name="city" placeholder="City" required /></Field>
                  <Field label="State"><Input name="state" placeholder="State" required /></Field>
                  <Field label="Postal Code"><Input name="postalCode" placeholder="Postal Code" required /></Field>
                  <Field label="Country"><Input name="country" placeholder="Country" required /></Field>
                </Grid>
              </Section>

              {/* Payment */}
              <Section title="Payment Details">
                <Grid>
                  <Field label="Remitter Name"><Input name="remitterName" placeholder="Remitter Name" required /></Field>
                  <Field label="Amount Paid"><Input name="amountPaid" placeholder="Amount Paid" inputMode="decimal" required /></Field>
                  <Field label="Currency">
                    <select name="currency" defaultValue="USD" required style={selectStyle}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </Grid>
              </Section>

              <Section title="Prescription (Optional)">
                <Grid>
                  <Field label="Upload Prescription">
                    <Input name="prescription" type="file" accept=".pdf,image/jpeg,image/png,image/webp" />
                  </Field>
                </Grid>
              </Section>

              <Section title="Dosage Information (Optional)">
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                  Fill this if your medication requires dosage tracking and refill reminders.
                </p>
                <Grid>
                  <Field label="Units Per Day"><Input name="dosagePerDay" type="number" min="1" placeholder="e.g. 1" inputMode="numeric" /></Field>
                  <Field label="Total Units in This Order"><Input name="totalDosages" type="number" min="1" placeholder="e.g. 30" inputMode="numeric" /></Field>
                  <Field label="Start Date"><Input name="dosageStartDate" type="date" /></Field>
                </Grid>
              </Section>
            </fieldset>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <button disabled={loading || isSubmitted} type="submit" className="btn btn-primary">
                {isSubmitted ? "Submitted" : loading ? "Submitting…" : "Submit"}
              </button>
              {err && <p style={{ fontSize: "0.85rem", color: "#b91c1c", margin: 0 }}>{err}</p>}
            </div>
          </form>
        </div>

        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "1rem", textAlign: "center" }}>
          This form link is unique and may expire.
        </p>
      </div>
    </div>
  );
}

/* ---------- tiny UI helpers ---------- */

const selectStyle: React.CSSProperties = {
  width: "100%", borderRadius: "var(--radius-md)", border: "1px solid var(--border)",
  background: "var(--surface-2)", padding: "0.625rem 0.875rem", color: "var(--text-primary)",
  fontSize: "0.875rem", outline: "none", cursor: "pointer",
};

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
