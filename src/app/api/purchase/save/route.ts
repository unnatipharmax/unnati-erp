import { PurchaseDocumentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";
import { getActiveCompanyId } from "../../../../lib/company";
import {
  getCreditNoteAmount,
  getPurchaseBillAmount,
  roundMoney,
} from "../../../../lib/purchaseAccounting";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 30;

type SavePayload = {
  party: {
    id?: string;
    name: string;
    address?: string | null;
    gstNumber?: string | null;
    drugLicenseNumber?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  bill: {
    invoiceNo?: string | null;
    invoiceDate?: string | null;
    totalAmount?: number | null;
    documentType?: PurchaseDocumentType | null;
  };
  products: Array<{
    id?: string;
    name: string;
    composition?: string | null;
    manufacturer?: string | null;
    hsn?: string | null;
    pack?: string | null;
    batchNo?: string | null;
    mfgDate?: string | null;
    expDate?: string | null;
    mrp?: number | null;
    gstPercent?: number | null;
    cgstPercent?: number | null;
    sgstPercent?: number | null;
    igstPercent?: number | null;
    taxableAmount?: number | null;
    cgstAmount?: number | null;
    sgstAmount?: number | null;
    igstAmount?: number | null;
    quantity: number;
    rate: number;
    discount?: number | null;
  }>;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS", "PACKAGING"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload: SavePayload = await req.json();
  const { party, bill, products } = payload;
  const documentType = bill?.documentType === PurchaseDocumentType.CREDIT_NOTE
    ? PurchaseDocumentType.CREDIT_NOTE
    : PurchaseDocumentType.BILL;

  if (!party?.name?.trim()) {
    return NextResponse.json({ error: "Party name is required" }, { status: 400 });
  }
  if (!products?.length) {
    return NextResponse.json({ error: "At least one product is required" }, { status: 400 });
  }

  const companyId = await getActiveCompanyId();

  try {
    let partyRecord: Awaited<ReturnType<typeof prisma.party.create>>;

    if (party.id) {
      // Only reuse a party that belongs to the active company; else treat as new.
      const ownedParty = await prisma.party.findFirst({ where: { id: party.id, companyId }, select: { id: true } });
      if (!ownedParty) party.id = undefined;
    }
    if (party.id) {
      partyRecord = await prisma.party.update({
        where: { id: party.id },
        data: {
          companyId,
          name: party.name.trim(),
          address: party.address || null,
          gstNumber: party.gstNumber || null,
          drugLicenseNumber: party.drugLicenseNumber || null,
        },
      });
    } else {
      const existing = await prisma.party.findFirst({
        where: { name: { equals: party.name.trim(), mode: "insensitive" }, companyId },
      });

      if (existing) {
        partyRecord = await prisma.party.update({
          where: { id: existing.id },
          data: {
            address: party.address || existing.address,
            gstNumber: party.gstNumber || existing.gstNumber,
            drugLicenseNumber: party.drugLicenseNumber || existing.drugLicenseNumber,
          },
        });
      } else {
        partyRecord = await prisma.party.create({
          data: {
            companyId,
            name: party.name.trim(),
            address: party.address || null,
            gstNumber: party.gstNumber || null,
            drugLicenseNumber: party.drugLicenseNumber || null,
          },
        });

        if (party.phone) {
          await prisma.phone.create({ data: { phone: party.phone, partyId: partyRecord.id } });
        }
        if (party.email) {
          await prisma.email.create({ data: { email: party.email, partyId: partyRecord.id } });
        }
      }
    }

    const computedDocumentAmount = documentType === PurchaseDocumentType.CREDIT_NOTE
      ? getCreditNoteAmount(products)
      : bill.totalAmount != null
        ? roundMoney(Number(bill.totalAmount))
        : getPurchaseBillAmount(products);

    const savedProducts: Array<{ id: string; name: string; isNew: boolean }> = [];
    const resolvedIds: string[] = [];

    for (const product of products) {
      let productRecord: Awaited<ReturnType<typeof prisma.product.create>>;

      if (product.id) {
        // Only update a product that belongs to the active company; otherwise
        // treat it as new (falls through to create below).
        const owned = await prisma.product.findFirst({ where: { id: product.id, companyId }, select: { id: true } });
        if (!owned) { product.id = undefined; }
      }
      if (product.id) {
        productRecord = await prisma.product.update({
          where: { id: product.id },
          data: {
            composition: product.composition || null,
            manufacturer: product.manufacturer || null,
            hsn: product.hsn || null,
            pack: product.pack || null,
            batchNo: product.batchNo || null,
            mfgDate: product.mfgDate || null,
            expDate: product.expDate || null,
            mrp: product.mrp ?? null,
            gstPercent: product.gstPercent ?? null,
          },
        });
        savedProducts.push({ id: productRecord.id, name: productRecord.name, isNew: false });
      } else {
        // Match to an existing product by NORMALIZED name (case/space/punctuation
        // insensitive) so a re-scanned "HORR F" reuses "HORRF" instead of creating
        // a duplicate. Exact match is tried first, then normalized.
        let existing = await prisma.product.findFirst({
          where: { name: { equals: product.name.trim(), mode: "insensitive" }, isActive: true, companyId },
        });
        if (!existing) {
          const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
          const target = norm(product.name);
          const candidates = await prisma.product.findMany({ where: { isActive: true, companyId } });
          existing = candidates.find(c => norm(c.name) === target) ?? null;
        }

        if (existing) {
          productRecord = await prisma.product.update({
            where: { id: existing.id },
            data: {
              composition: product.composition || existing.composition,
              manufacturer: product.manufacturer || existing.manufacturer,
              hsn: product.hsn || existing.hsn,
              pack: product.pack || existing.pack,
              batchNo: product.batchNo || null,
              mfgDate: product.mfgDate || null,
              expDate: product.expDate || null,
              mrp: product.mrp ?? existing.mrp,
              gstPercent: product.gstPercent ?? existing.gstPercent,
            },
          });
          savedProducts.push({ id: productRecord.id, name: productRecord.name, isNew: false });
        } else {
          productRecord = await prisma.product.create({
            data: {
              companyId,
              name: product.name.trim(),
              composition: product.composition || null,
              manufacturer: product.manufacturer || null,
              hsn: product.hsn || null,
              pack: product.pack || null,
              batchNo: product.batchNo || null,
              mfgDate: product.mfgDate || null,
              expDate: product.expDate || null,
              mrp: product.mrp ?? null,
              gstPercent: product.gstPercent ?? null,
            },
          });
          savedProducts.push({ id: productRecord.id, name: productRecord.name, isNew: true });
        }
      }

      resolvedIds.push(productRecord.id);
    }

    const purchaseBill = await prisma.purchaseBill.create({
      data: {
        invoiceNo: bill.invoiceNo || null,
        invoiceDate: bill.invoiceDate ? new Date(bill.invoiceDate) : null,
        partyId: partyRecord.id,
        companyId,
        documentType,
        totalAmount: computedDocumentAmount,
      },
    });

    await prisma.purchaseItem.createMany({
      data: products.map((product, index) => ({
        productId: resolvedIds[index],
        purchaseId: purchaseBill.id,
        companyId,
        batch: product.batchNo || null,
        expiry: product.expDate || null,
        quantity: product.quantity || 1,
        rate: product.rate || 0,
        discount: product.discount ?? null,
        mrp: product.mrp ?? null,
        gstPercent: product.gstPercent ?? null,
        cgstPercent: product.cgstPercent ?? null,
        sgstPercent: product.sgstPercent ?? null,
        igstPercent: product.igstPercent ?? null,
        taxableAmount: product.taxableAmount ?? null,
        cgstAmount: product.cgstAmount ?? null,
        sgstAmount: product.sgstAmount ?? null,
        igstAmount: product.igstAmount ?? null,
      })),
    });

    // Update stock on hand: a BILL adds the purchased quantity to each product's
    // stock; a CREDIT_NOTE (purchase return) subtracts it.
    {
      const sign = documentType === PurchaseDocumentType.CREDIT_NOTE ? -1 : 1;
      for (let i = 0; i < products.length; i++) {
        const qty = Number(products[i].quantity) || 0;
        if (qty <= 0) continue;
        const productId = resolvedIds[i];
        // Read current qty (null → 0), then set new value clamped at 0.
        const current = await prisma.product.findUnique({ where: { id: productId }, select: { qty: true } });
        const newQty = Math.max(0, (current?.qty ?? 0) + sign * qty);
        await prisma.product.update({ where: { id: productId }, data: { qty: newQty } });
      }
    }

    let creditNoteAdjustedAmount = 0;
    let netPayableAmount = computedDocumentAmount;
    let creditNotesUsed: Array<{ id: string; invoiceNo: string | null; appliedAmount: number }> = [];

    if (documentType === PurchaseDocumentType.BILL && computedDocumentAmount > 0) {
      const openCreditNotes = await prisma.purchaseBill.findMany({
        where: {
          partyId: partyRecord.id,
          companyId,
          documentType: PurchaseDocumentType.CREDIT_NOTE,
          createdAt: { lte: purchaseBill.createdAt },
        },
        orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          invoiceNo: true,
          totalAmount: true,
          creditNoteAllocations: { select: { amount: true } },
        },
      });

      let remainingBillBalance = computedDocumentAmount;
      const allocationsToCreate: Array<{ creditNoteId: string; billId: string; amount: number }> = [];

      for (const note of openCreditNotes) {
        if (remainingBillBalance <= 0.01) {
          break;
        }

        const noteAmount = roundMoney(Number(note.totalAmount ?? 0));
        const alreadyAdjusted = roundMoney(
          note.creditNoteAllocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0)
        );
        const availableAmount = roundMoney(noteAmount - alreadyAdjusted);

        if (availableAmount <= 0.01) {
          continue;
        }

        const appliedAmount = roundMoney(Math.min(remainingBillBalance, availableAmount));
        allocationsToCreate.push({
          creditNoteId: note.id,
          billId: purchaseBill.id,
          amount: appliedAmount,
        });
        creditNotesUsed.push({
          id: note.id,
          invoiceNo: note.invoiceNo,
          appliedAmount,
        });
        creditNoteAdjustedAmount = roundMoney(creditNoteAdjustedAmount + appliedAmount);
        remainingBillBalance = roundMoney(remainingBillBalance - appliedAmount);
      }

      if (allocationsToCreate.length > 0) {
        await prisma.purchaseCreditNoteAllocation.createMany({ data: allocationsToCreate });
      }

      netPayableAmount = roundMoney(computedDocumentAmount - creditNoteAdjustedAmount);
    }

    return NextResponse.json({
      success: true,
      result: {
        partyId: partyRecord.id,
        partyName: partyRecord.name,
        billId: purchaseBill.id,
        invoiceNo: purchaseBill.invoiceNo,
        documentType,
        totalAmount: computedDocumentAmount,
        creditNoteAdjustedAmount,
        netPayableAmount,
        creditNotesUsed,
        products: savedProducts,
        newProducts: savedProducts.filter((product) => product.isNew).length,
        updProducts: savedProducts.filter((product) => !product.isNew).length,
      },
    });
  } catch (error: any) {
    console.error("[purchase/save error]", error);
    return NextResponse.json({ error: error?.message || "Save failed" }, { status: 500 });
  }
}
