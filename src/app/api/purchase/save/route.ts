// src/app/api/purchase/save/route.ts
// POST — atomically saves: party (upsert), products (upsert by name),
//         purchase bill + items. Returns summary of what was created/updated.
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

type SavePayload = {
  party: {
    id?:               string;  // if matched to existing
    name:              string;
    address?:          string | null;
    gstNumber?:        string | null;
    drugLicenseNumber?: string | null;
    phone?:            string | null;
    email?:            string | null;
  };
  bill: {
    invoiceNo?:   string | null;
    invoiceDate?: string | null;  // YYYY-MM-DD
    totalAmount?: number | null;
  };
  products: Array<{
    id?:           string;
    name:          string;
    composition?:  string | null;
    manufacturer?: string | null;
    hsn?:          string | null;
    pack?:         string | null;
    batchNo?:      string | null;
    mfgDate?:      string | null;
    expDate?:      string | null;
    mrp?:          number | null;
    gstPercent?:   number | null;   // total GST %
    cgstPercent?:  number | null;   // CGST %
    sgstPercent?:  number | null;   // SGST %
    igstPercent?:  number | null;   // IGST %
    taxableAmount?: number | null;
    cgstAmount?:   number | null;
    sgstAmount?:   number | null;
    igstAmount?:   number | null;
    quantity:      number;
    rate:          number;
    discount?:     number | null;
  }>;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS", "PACKAGING"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload: SavePayload = await req.json();
  const { party, bill, products } = payload;

  if (!party?.name?.trim())
    return NextResponse.json({ error: "Party name is required" }, { status: 400 });
  if (!products?.length)
    return NextResponse.json({ error: "At least one product is required" }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {

      // ── 1. Upsert Party ──────────────────────────────────────────────────
      let partyRecord: any;
      if (party.id) {
        // Update existing
        partyRecord = await tx.party.update({
          where: { id: party.id },
          data: {
            name:              party.name.trim(),
            address:           party.address           || null,
            gstNumber:         party.gstNumber         || null,
            drugLicenseNumber: party.drugLicenseNumber || null,
          },
        });
      } else {
        // Try find by name first (case-insensitive)
        const existing = await tx.party.findFirst({
          where: { name: { equals: party.name.trim(), mode: "insensitive" } },
        });
        if (existing) {
          partyRecord = await tx.party.update({
            where: { id: existing.id },
            data: {
              address:           party.address           || existing.address,
              gstNumber:         party.gstNumber         || existing.gstNumber,
              drugLicenseNumber: party.drugLicenseNumber || existing.drugLicenseNumber,
            },
          });
        } else {
          partyRecord = await tx.party.create({
            data: {
              name:              party.name.trim(),
              address:           party.address           || null,
              gstNumber:         party.gstNumber         || null,
              drugLicenseNumber: party.drugLicenseNumber || null,
            },
          });
          // Add phone if provided
          if (party.phone) {
            await tx.phone.create({ data: { phone: party.phone, partyId: partyRecord.id } });
          }
          // Add email if provided
          if (party.email) {
            await tx.email.create({ data: { email: party.email, partyId: partyRecord.id } });
          }
        }
      }

      // ── 2. Upsert Products + collect for purchase items ──────────────────
      const savedProducts: Array<{ id: string; name: string; isNew: boolean }> = [];

      for (const p of products) {
        let productRecord: any;

        if (p.id) {
          // Has explicit ID — update batch/dates + composition
          productRecord = await tx.product.update({
            where: { id: p.id },
            data: {
              composition:  p.composition  || null,
              manufacturer: p.manufacturer || null,
              hsn:          p.hsn          || null,
              pack:         p.pack         || null,
              batchNo:      p.batchNo      || null,
              mfgDate:      p.mfgDate      || null,
              expDate:      p.expDate      || null,
              mrp:          p.mrp          ?? null,
              gstPercent:   p.gstPercent   ?? null,
            },
          });
          savedProducts.push({ id: productRecord.id, name: productRecord.name, isNew: false });
        } else {
          // Find by name (case-insensitive)
          const existing = await tx.product.findFirst({
            where: {
              name:     { equals: p.name.trim(), mode: "insensitive" },
              isActive: true,
            },
          });

          if (existing) {
            // Update with new batch / dates from this bill
            productRecord = await tx.product.update({
              where: { id: existing.id },
              data: {
                // Only overwrite if new value provided
                composition:  p.composition  || existing.composition,
                manufacturer: p.manufacturer || existing.manufacturer,
                hsn:          p.hsn          || existing.hsn,
                pack:         p.pack         || existing.pack,
                batchNo:      p.batchNo      || null,   // always update batch from new bill
                mfgDate:      p.mfgDate      || null,
                expDate:      p.expDate      || null,
                mrp:          p.mrp          ?? existing.mrp,
                gstPercent:   p.gstPercent   ?? existing.gstPercent,
              },
            });
            savedProducts.push({ id: productRecord.id, name: productRecord.name, isNew: false });
          } else {
            // Create new product
            productRecord = await tx.product.create({
              data: {
                name:         p.name.trim(),
                composition:  p.composition  || null,
                manufacturer: p.manufacturer || null,
                hsn:          p.hsn          || null,
                pack:         p.pack         || null,
                batchNo:      p.batchNo      || null,
                mfgDate:      p.mfgDate      || null,
                expDate:      p.expDate      || null,
                mrp:          p.mrp          ?? null,
                gstPercent:   p.gstPercent   ?? null,
              },
            });
            savedProducts.push({ id: productRecord.id, name: productRecord.name, isNew: true });
          }
        }

        // Store resolved id back for purchase item creation
        (p as any)._resolvedId = productRecord.id;
      }

      // ── 3. Create PurchaseBill ───────────────────────────────────────────
      const purchaseBill = await tx.purchaseBill.create({
        data: {
          invoiceNo:   bill.invoiceNo   || null,
          invoiceDate: bill.invoiceDate ? new Date(bill.invoiceDate) : null,
          partyId:     partyRecord.id,
          totalAmount: bill.totalAmount ?? null,
        },
      });

      // ── 4. Create PurchaseItems ──────────────────────────────────────────
      for (const p of products) {
        await tx.purchaseItem.create({
          data: {
            productId:     (p as any)._resolvedId,
            purchaseId:    purchaseBill.id,
            batch:         p.batchNo       || null,
            expiry:        p.expDate       || null,
            quantity:      p.quantity      || 1,
            rate:          p.rate          || 0,
            discount:      p.discount      ?? null,
            mrp:           p.mrp           ?? null,
            // GST breakdown
            gstPercent:    p.gstPercent    ?? null,
            cgstPercent:   p.cgstPercent   ?? null,
            sgstPercent:   p.sgstPercent   ?? null,
            igstPercent:   p.igstPercent   ?? null,
            taxableAmount: p.taxableAmount ?? null,
            cgstAmount:    p.cgstAmount    ?? null,
            sgstAmount:    p.sgstAmount    ?? null,
            igstAmount:    p.igstAmount    ?? null,
          },
        });
      }

      return {
        partyId:      partyRecord.id,
        partyName:    partyRecord.name,
        billId:       purchaseBill.id,
        invoiceNo:    purchaseBill.invoiceNo,
        products:     savedProducts,
        newProducts:  savedProducts.filter(p => p.isNew).length,
        updProducts:  savedProducts.filter(p => !p.isNew).length,
      };
    });

    return NextResponse.json({ success: true, result });
  } catch (e: any) {
    console.error("[purchase/save error]", e);
    return NextResponse.json({ error: e?.message || "Save failed" }, { status: 500 });
  }
}