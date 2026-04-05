// GET  /api/dosage-reminders        — list all orders with dosage tracking (upcoming + overdue)
// POST /api/dosage-reminders        — manually trigger sending of due reminders

import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/auth";
import { sendDosageReminder } from "../../../lib/email";

export const runtime = "nodejs";

// ── List upcoming reminders ────────────────────────────────────────────────────
export async function GET() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orders = await prisma.orderInitiation.findMany({
    where: { dosageReminderDate: { not: null } },
    orderBy: { dosageReminderDate: "asc" },
    select: {
      id:                  true,
      invoiceNo:           true,
      fullName:            true,
      email:               true,
      country:             true,
      dosagePerDay:        true,
      totalDosages:        true,
      dosageStartDate:     true,
      dosageReminderDate:  true,
      dosageReminderSent:  true,
      prescriptionOriginalName: true,
      orderEntry: {
        select: {
          items: { select: { quantity: true, product: { select: { name: true } } } },
        },
      },
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return NextResponse.json({
    reminders: orders.map(o => {
      const reminderDate = o.dosageReminderDate!;
      const daysUntil    = Math.ceil((reminderDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const daysSupply   = o.dosagePerDay && o.totalDosages ? Math.floor(o.totalDosages / o.dosagePerDay) : null;
      return {
        id:                 o.id,
        invoiceNo:          o.invoiceNo,
        fullName:           o.fullName,
        email:              o.email,
        country:            o.country,
        dosagePerDay:       o.dosagePerDay,
        totalDosages:       o.totalDosages,
        daysSupply,
        dosageStartDate:    o.dosageStartDate?.toISOString().split("T")[0] ?? null,
        dosageReminderDate: reminderDate.toISOString().split("T")[0],
        dosageReminderSent: o.dosageReminderSent,
        hasPrescription:    !!o.prescriptionOriginalName,
        daysUntil,
        status: o.dosageReminderSent
          ? "sent"
          : daysUntil <= 0
            ? "overdue"
            : daysUntil <= 3
              ? "due_soon"
              : "upcoming",
        products: (o.orderEntry?.items ?? []).map(i => i.product.name).join(", "),
      };
    }),
  });
}

// ── Trigger sending due reminders ─────────────────────────────────────────────
export async function POST(req: Request) {
  // Allow both manual trigger (with session) and cron trigger (with secret header)
  const cronSecret = req.headers.get("x-cron-secret");
  const isCron     = cronSecret === process.env.CRON_SECRET;

  if (!isCron) {
    const session = await getSession();
    if (!session || !["ADMIN", "MANAGER"].includes(session.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // Find all unsent reminders due today or overdue
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

  const results: { id: string; invoiceNo: string | null; status: "sent" | "failed"; error?: string }[] = [];

  for (const order of due) {
    try {
      const daysSupply = Math.floor(order.totalDosages! / order.dosagePerDay!);
      const products   = (order.orderEntry?.items ?? []).map(i => i.product.name).join(", ");

      await sendDosageReminder({
        clientName:    order.fullName,
        clientEmail:   order.email,
        invoiceNo:     order.invoiceNo ?? "N/A",
        products,
        totalDosages:  order.totalDosages!,
        dosagePerDay:  order.dosagePerDay!,
        daysSupply,
        startDate:     order.dosageStartDate?.toISOString().split("T")[0] ?? "N/A",
        reminderDate:  order.dosageReminderDate!.toISOString().split("T")[0],
      });

      await prisma.orderInitiation.update({
        where: { id: order.id },
        data:  { dosageReminderSent: true },
      });

      results.push({ id: order.id, invoiceNo: order.invoiceNo, status: "sent" });
    } catch (e: any) {
      results.push({ id: order.id, invoiceNo: order.invoiceNo, status: "failed", error: e?.message });
    }
  }

  return NextResponse.json({ sent: results.filter(r => r.status === "sent").length, results });
}
