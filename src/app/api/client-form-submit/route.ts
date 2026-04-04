import { NextResponse } from "next/server";
import { Prisma, OrderSource } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  deletePrescriptionUpload,
  preparePrescriptionUpload,
  savePrescriptionUpload,
} from "../../../lib/prescriptions";
import { sendOrderConfirmation } from "../../../lib/email";

export const runtime = "nodejs"; // keep Prisma + crypto stable on dev

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

    // 1) "Lock" the link WITHOUT a transaction
    const lock = await prisma.clientFormLink.updateMany({
      where: {
        token,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    if (lock.count === 0) {
      const existing = await prisma.clientFormLink.findUnique({
        where: { token },
        select: { isUsed: true, expiresAt: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Invalid link" }, { status: 400 });
      }

      if (existing.isUsed) {
        return NextResponse.json(
          { error: "Link already used" },
          { status: 400 }
        );
      }

      return NextResponse.json({ error: "Link expired" }, { status: 400 });
    }

    try {
      if (pendingPrescription) {
        savedPrescription = await savePrescriptionUpload(pendingPrescription);
      }

      // 2) Create order
      const order = await prisma.orderInitiation.create({
        data: {
          source: OrderSource.CLIENT,
          clientFormToken: token,
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

      // 3) Attach orderId to link (best-effort)
      await prisma.clientFormLink.update({
        where: { token },
        data: { orderId: order.id },
      });

      // 4) Send confirmation emails (best-effort — never block the response)
      sendOrderConfirmation({
        orderId:     order.id,
        clientEmail: email,
        clientName:  fullName,
      }).catch(e => console.error("Confirmation email error:", e));

      return NextResponse.json({ orderId: order.id });
    } catch (innerError) {
      if (!orderCreated) {
        await deletePrescriptionUpload(savedPrescription?.storedName);
      }
      throw innerError;
    }
  } catch (e: unknown) {
    console.error("client-form-submit error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 }
    );
  }
}
