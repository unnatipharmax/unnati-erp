import { NextResponse } from "next/server";
import { Prisma, OrderSource } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  deletePrescriptionUpload,
  preparePrescriptionUpload,
  savePrescriptionUpload,
} from "../../../lib/prescriptions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const token = String(form.get("token") ?? "").trim();
    const fullName = String(form.get("fullName") ?? "").trim();
    const address = String(form.get("address") ?? "").trim();
    const city = String(form.get("city") ?? "").trim();
    const state = String(form.get("state") ?? "").trim();
    const postalCode = String(form.get("postalCode") ?? "").trim();
    const country = String(form.get("country") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const remitterName = String(form.get("remitterName") ?? "").trim();
    const amountPaid = String(form.get("amountPaid") ?? "").trim();
    const currency = String(form.get("currency") ?? "").trim();
    const pendingPrescription = await preparePrescriptionUpload(
      form.get("prescription")
    );
    let orderCreated = false;
    let savedPrescription: Awaited<
      ReturnType<typeof savePrescriptionUpload>
    > | null = null;

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    // 1 Validate multi-order link
    const link = await prisma.clientAccountLink.findUnique({
      where: { token },
      include: { account: true },
    });

    if (!link || !link.isActive || !link.account.isActive) {
      return NextResponse.json(
        { error: "Invalid or inactive link" },
        { status: 400 }
      );
    }

    try {
      if (pendingPrescription) {
        savedPrescription = await savePrescriptionUpload(pendingPrescription);
      }

      // 2 Create order initiation (NO balance deduction here)
      const order = await prisma.orderInitiation.create({
        data: {
          source: OrderSource.CLIENT,
          clientFormToken: token,
          accountId: link.accountId,
          fullName,
          address,
          city,
          state,
          postalCode,
          country,
          email,
          phone,
          remitterName,
          amountPaid: new Prisma.Decimal(String(amountPaid || "0")),
          currency: currency || "INR",
          prescriptionOriginalName: savedPrescription?.originalName,
          prescriptionStoredName: savedPrescription?.storedName,
          prescriptionMimeType: savedPrescription?.mimeType,
        },
        select: { id: true },
      });
      orderCreated = true;

      return NextResponse.json({
        orderId: order.id,
        accountName: link.account.name,
        remainingBalance: link.account.balance, // unchanged for now
      });
    } catch (innerError) {
      if (!orderCreated) {
        await deletePrescriptionUpload(savedPrescription?.storedName);
      }
      throw innerError;
    }
  } catch (e: unknown) {
    console.error("client-multi-form-submit error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 }
    );
  }
}
