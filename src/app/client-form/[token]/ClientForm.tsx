"use client";

import { useMemo, useState } from "react";

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

    const payload = {
      token,
      fullName: form.get("fullName"),
      address: form.get("address"),
      city: form.get("city"),
      state: form.get("state"),
      postalCode: form.get("postalCode"),
      country: form.get("country"),
      email: form.get("email"),
      phone: form.get("phone"),
      remitterName: form.get("remitterName"),
      amountPaid: form.get("amountPaid"),
      currency: form.get("currency"),
    };

    const res = await fetch("/api/client-form-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-start justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-xl p-6">
          <h2 className="text-2xl font-semibold">Client Order Form</h2>
          <p className="text-sm text-slate-400 mt-1">
            Please fill all details carefully.
          </p>

          {/* Success box */}
          {ok && (
            <div className="mt-5 rounded-2xl border border-emerald-700/40 bg-emerald-500/10 p-4">
              <div className="font-semibold text-emerald-300">
                ✅ Submitted successfully
              </div>
              <div className="text-sm text-slate-200 mt-1">
                Order: <span className="font-bold">#{shortOrder}</span>
              </div>
              <div className="text-xs text-slate-400 mt-2 break-all">
                Internal ID: {ok.orderId}
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-6">
            {/* Disable everything after submit */}
            <fieldset
              disabled={loading || isSubmitted}
              className={isSubmitted ? "opacity-70" : ""}
            >
              {/* Contact */}
              <Section title="Contact Details">
                <Grid>
                  <Field label="Full Name">
                    <Input name="fullName" placeholder="Full Name" required />
                  </Field>
                  <Field label="Email">
                    <Input
                      name="email"
                      placeholder="Email"
                      type="email"
                      required
                    />
                  </Field>
                  <Field label="Phone">
                    <Input name="phone" placeholder="Phone" required />
                  </Field>
                </Grid>
              </Section>

              {/* Address */}
              <Section title="Address">
                <Grid>
                  <Field label="Address">
                    <Input name="address" placeholder="Address" required />
                  </Field>
                  <Field label="City">
                    <Input name="city" placeholder="City" required />
                  </Field>
                  <Field label="State">
                    <Input name="state" placeholder="State" required />
                  </Field>
                  <Field label="Postal Code">
                    <Input name="postalCode" placeholder="Postal Code" required />
                  </Field>
                  <Field label="Country">
                    <Input name="country" placeholder="Country" required />
                  </Field>
                </Grid>
              </Section>

              {/* Payment */}
              <Section title="Payment Details">
                <Grid>
                  <Field label="Remitter Name">
                    <Input
                      name="remitterName"
                      placeholder="Remitter Name"
                      required
                    />
                  </Field>
                  <Field label="Amount Paid">
                    <Input
                      name="amountPaid"
                      placeholder="Amount Paid"
                      inputMode="decimal"
                      required
                    />
                  </Field>
                  <Field label="Currency">
                    <Input
                      name="currency"
                      placeholder="Currency (e.g. INR)"
                      defaultValue="INR or USD"
                      required
                    />
                  </Field>
                </Grid>
              </Section>
            </fieldset>

            <div className="flex items-center gap-3">
              <button
                disabled={loading || isSubmitted}
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed font-semibold"
              >
                {isSubmitted ? "Submitted" : loading ? "Submitting..." : "Submit"}
              </button>

              {err && <p className="text-sm text-red-400">{err}</p>}
            </div>
          </form>
        </div>

        <p className="text-xs text-slate-500 mt-4">
          This form link is unique and may expire.
        </p>
      </div>
    </div>
  );
}

/* ---------- tiny UI helpers ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-200 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-blue-600"
    />
  );
}
