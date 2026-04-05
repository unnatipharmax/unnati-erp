// GET /api/dosage-reminders/cron
// Called daily at 7am by Vercel Cron Jobs (vercel.json).
// Forwards to the POST /api/dosage-reminders handler with the cron secret.

import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { sendDosageReminder } from "../../../../lib/email";

export const runtime = "nodejs";

export async function GET(req: Request) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (process.env.CRON_SECRET && token !== process.env.CRON_SECRET)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const due = await prisma.orderInitiation.findMany({
    where: {
      dosageReminderDate:  { lte: today },
      dosageReminderSent:  false,
      dosagePerDay:        { not: null },
      totalDosages:        { not: null },
    },
    select: {
      id:                  true,
      invoiceNo:           true,
      fullName:            true,
      email:               true,
      dosagePerDay:        true,
      totalDosages:        true,
      dosageStartDate:     true,
      dosageReminderDate:  true,
      orderEntry: {
        select: {
          items: { select: { quantity: true, product: { select: { name: true } } } },
        },
      },
    },
  });

  let sent = 0;
  for (const order of due) {
    try {
      const daysSupply = Math.floor(order.totalDosages! / order.dosagePerDay!);
      const products   = (order.orderEntry?.items ?? []).map(i => i.product.name).join(", ");

      await sendDosageReminder({
        clientName:   order.fullName,
        clientEmail:  order.email,
        invoiceNo:    order.invoiceNo ?? "N/A",
        products,
        totalDosages: order.totalDosages!,
        dosagePerDay: order.dosagePerDay!,
        daysSupply,
        startDate:    order.dosageStartDate?.toISOString().split("T")[0] ?? "N/A",
        reminderDate: order.dosageReminderDate!.toISOString().split("T")[0],
      });

      await prisma.orderInitiation.update({
        where: { id: order.id },
        data:  { dosageReminderSent: true },
      });
      sent++;
    } catch (e) {
      console.error("Dosage reminder failed for", order.id, e);
    }
  }

  return NextResponse.json({ ok: true, sent, total: due.length });
}
