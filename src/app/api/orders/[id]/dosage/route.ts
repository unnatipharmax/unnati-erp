// PATCH /api/orders/[id]/dosage
// Save dosage tracking info and auto-calculate the reminder date.
// Reminder fires 7 days before dosages are expected to run out.

import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { getSession } from "../../../../../lib/auth";
import { getActiveCompanyId } from "../../../../../lib/company";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "PACKAGING"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const companyId = await getActiveCompanyId();
  const { id } = await params;
  const { dosagePerDay, totalDosages, dosageStartDate } = await req.json();

  if (!dosagePerDay || dosagePerDay <= 0)
    return NextResponse.json({ error: "dosagePerDay must be > 0" }, { status: 400 });
  if (!totalDosages || totalDosages <= 0)
    return NextResponse.json({ error: "totalDosages must be > 0" }, { status: 400 });

  const order = await prisma.orderInitiation.findFirst({
    where: { id, companyId },
    select: { id: true, prescriptionOriginalName: true },
  });
  if (!order)
    return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const startDate = dosageStartDate ? new Date(dosageStartDate) : new Date();

  // Days supply = totalDosages / dosagePerDay
  const daysSupply = Math.floor(totalDosages / dosagePerDay);

  // Send reminder 7 days before stock runs out
  const reminderOffset = Math.max(0, daysSupply - 7);
  const dosageReminderDate = new Date(startDate);
  dosageReminderDate.setDate(dosageReminderDate.getDate() + reminderOffset);

  await prisma.orderInitiation.updateMany({
    where: { id, companyId },
    data: {
      dosagePerDay,
      totalDosages,
      dosageStartDate:    startDate,
      dosageReminderDate,
      dosageReminderSent: false, // reset if updated
    },
  });

  const updated = await prisma.orderInitiation.findFirst({
    where: { id, companyId },
    select: {
      id:                 true,
      dosagePerDay:       true,
      totalDosages:       true,
      dosageStartDate:    true,
      dosageReminderDate: true,
      dosageReminderSent: true,
    },
  });
  if (!updated)
    return NextResponse.json({ error: "Order not found" }, { status: 404 });

  return NextResponse.json({
    ...updated,
    daysSupply,
    dosageStartDate:    updated.dosageStartDate?.toISOString().split("T")[0] ?? null,
    dosageReminderDate: updated.dosageReminderDate?.toISOString().split("T")[0] ?? null,
  });
}
