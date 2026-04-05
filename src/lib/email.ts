import nodemailer from "nodemailer";

// ── Transporter (singleton) ───────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   ?? "smtp.gmail.com",
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: false, // STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Send order confirmation ───────────────────────────────────────────────────
export async function sendOrderConfirmation({
  orderId,
  clientEmail,
  clientName,
}: {
  orderId:     string;
  clientEmail: string;
  clientName:  string;
}) {
  const officeEmail = process.env.OFFICE_EMAIL;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("Email not configured — skipping confirmation email.");
    return;
  }

  const subject = `Order Confirmation — ID: ${orderId}`;

  const clientHtml = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
      <div style="background:#6366f1;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">Unnati Pharmax</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px">Order Confirmation</p>
      </div>
      <div style="background:#f8f9ff;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none">
        <p style="margin:0 0 16px;font-size:15px">Dear <strong>${clientName}</strong>,</p>
        <p style="margin:0 0 24px;font-size:14px;color:#374151">
          Thank you for placing your order. We have received it and it is now being processed.
        </p>
        <div style="background:#ede9fe;border-left:4px solid #6366f1;padding:16px 20px;border-radius:4px;margin-bottom:24px">
          <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Your Order ID</p>
          <p style="margin:6px 0 0;font-size:18px;font-weight:700;font-family:monospace;color:#4338ca">${orderId}</p>
        </div>
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280">
          Please keep this Order ID for your reference. Our team will contact you shortly with further updates.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">
          Unnati Pharmax &nbsp;|&nbsp; This is an automated confirmation email.
        </p>
      </div>
    </div>
  `;

  const officeHtml = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
      <div style="background:#1e293b;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700">New Order Received</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.6);font-size:12px">Unnati Pharmax — Internal Alert</p>
      </div>
      <div style="background:#f8fafc;padding:28px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr>
            <td style="padding:8px 0;color:#64748b;width:140px">Order ID</td>
            <td style="padding:8px 0;font-family:monospace;font-weight:700;color:#4338ca">${orderId}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b">Client Name</td>
            <td style="padding:8px 0;font-weight:600">${clientName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b">Client Email</td>
            <td style="padding:8px 0">${clientEmail}</td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:12px;color:#94a3b8">
          Log in to the ERP to view full order details.
        </p>
      </div>
    </div>
  `;

  const recipients: Promise<unknown>[] = [];

  // Email to client
  recipients.push(
    transporter.sendMail({
      from:    `"Unnati Pharmax" <${process.env.SMTP_USER}>`,
      to:      clientEmail,
      subject,
      html:    clientHtml,
    })
  );

  // Email to office (if configured and different from sender)
  if (officeEmail) {
    recipients.push(
      transporter.sendMail({
        from:    `"Unnati Pharmax ERP" <${process.env.SMTP_USER}>`,
        to:      officeEmail,
        subject: `[New Order] ${orderId} — ${clientName}`,
        html:    officeHtml,
      })
    );
  }

  await Promise.allSettled(recipients);
}

// ── Send dosage reminder ───────────────────────────────────────────────────────
export async function sendDosageReminder({
  clientEmail,
  clientName,
  invoiceNo,
  products,
  totalDosages,
  dosagePerDay,
  daysSupply,
  startDate,
  reminderDate,
}: {
  clientEmail:  string;
  clientName:   string;
  invoiceNo:    string;
  products:     string;
  totalDosages: number;
  dosagePerDay: number;
  daysSupply:   number;
  startDate:    string;
  reminderDate: string;
}) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("Email not configured — skipping dosage reminder.");
    return;
  }

  const officeEmail = process.env.OFFICE_EMAIL;
  const runOutDate  = new Date(startDate);
  runOutDate.setDate(runOutDate.getDate() + daysSupply);
  const runOutStr = runOutDate.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  const clientHtml = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
      <div style="background:#6366f1;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">Unnati Pharmax</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px">Medication Refill Reminder</p>
      </div>
      <div style="background:#f8f9ff;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none">
        <p style="margin:0 0 16px;font-size:15px">Dear <strong>${clientName}</strong>,</p>
        <p style="margin:0 0 20px;font-size:14px;color:#374151">
          This is a friendly reminder that your medication supply from invoice
          <strong style="font-family:monospace;color:#4338ca">${invoiceNo}</strong>
          is expected to run out around <strong>${runOutStr}</strong>.
        </p>

        <div style="background:#ede9fe;border-left:4px solid #6366f1;padding:16px 20px;border-radius:4px;margin-bottom:24px">
          <table style="width:100%;font-size:13px;border-collapse:collapse">
            <tr><td style="color:#6b7280;padding:3px 0;width:140px">Medication</td><td style="font-weight:600">${products}</td></tr>
            <tr><td style="color:#6b7280;padding:3px 0">Total Dosages</td><td style="font-weight:600">${totalDosages} units</td></tr>
            <tr><td style="color:#6b7280;padding:3px 0">Dosage / Day</td><td style="font-weight:600">${dosagePerDay} unit${dosagePerDay !== 1 ? "s" : ""}</td></tr>
            <tr><td style="color:#6b7280;padding:3px 0">Supply Duration</td><td style="font-weight:600">${daysSupply} days</td></tr>
            <tr><td style="color:#6b7280;padding:3px 0">Expected Run-out</td><td style="font-weight:700;color:#4338ca">${runOutStr}</td></tr>
          </table>
        </div>

        <p style="margin:0 0 20px;font-size:14px;color:#374151">
          Please contact us to place your next order before your current supply runs out to avoid any interruption in your treatment.
        </p>

        <p style="margin:0;font-size:13px;color:#6b7280">
          To reorder, simply reply to this email or contact Unnati Pharmax directly.
        </p>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">
          Unnati Pharmax &nbsp;|&nbsp; Ref: Invoice ${invoiceNo}
        </p>
      </div>
    </div>
  `;

  const officeHtml = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#1e293b;padding:20px 28px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;color:#fff;font-size:17px">Dosage Reminder Sent</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.6);font-size:12px">Unnati Pharmax — Internal Alert</p>
      </div>
      <div style="background:#f8fafc;padding:24px 28px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none;font-size:14px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#64748b;width:140px">Invoice</td><td style="font-family:monospace;font-weight:700;color:#4338ca">${invoiceNo}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Client</td><td style="font-weight:600">${clientName}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Email</td><td>${clientEmail}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Medication</td><td>${products}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Run-out Date</td><td style="font-weight:700;color:#dc2626">${runOutStr}</td></tr>
        </table>
      </div>
    </div>
  `;

  const sends: Promise<unknown>[] = [
    transporter.sendMail({
      from:    `"Unnati Pharmax" <${process.env.SMTP_USER}>`,
      to:      clientEmail,
      subject: `Medication Refill Reminder — ${products}`,
      html:    clientHtml,
    }),
  ];

  if (officeEmail) {
    sends.push(
      transporter.sendMail({
        from:    `"Unnati Pharmax ERP" <${process.env.SMTP_USER}>`,
        to:      officeEmail,
        subject: `[Dosage Reminder Sent] ${invoiceNo} — ${clientName}`,
        html:    officeHtml,
      })
    );
  }

  await Promise.allSettled(sends);
}
