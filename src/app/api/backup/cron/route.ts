import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "../../../../lib/prisma";
import fs from "fs";
import path from "path";

const BACKUP_DIR = path.join(process.cwd(), "backups");
const MAX_BACKUPS = 30;

// Vercel calls this at 2 AM UTC daily (set in vercel.json)
// Also works as a local cron via Windows Task Scheduler hitting this endpoint
export async function GET(req: NextRequest) {
  // Vercel cron passes Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const [
      users,
      parties,
      products,
      productGroups,
      purchaseBills,
      purchaseItems,
      partyPayments,
      orders,
      orderEntries,
      orderEntryItems,
      clients,
      ledger,
      expenses,
      exportReturns,
      exportReturnItems,
      invoiceSequences,
    ] = await Promise.all([
      db.user.findMany({ select: { id: true, username: true, name: true, role: true, isActive: true, createdAt: true } }),
      db.party.findMany({ include: { emails: true, phones: true } }),
      db.product.findMany(),
      db.productGroup.findMany(),
      db.purchaseBill.findMany({ include: { items: true } }),
      db.purchaseItem.findMany(),
      db.partyPayment.findMany({ include: { allocations: true } }),
      db.orderInitiation.findMany(),
      db.orderEntry.findMany(),
      db.orderEntryItem.findMany(),
      db.clientAccount.findMany({ include: { phones: true, emails: true } }),
      db.accountLedger.findMany(),
      db.expense.findMany(),
      db.exportReturn.findMany(),
      db.exportReturnItem.findMany(),
      db.invoiceSequence.findMany(),
    ]);

    const snapshot = {
      meta: {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        exportedBy: "Vercel Cron Auto-Backup",
        counts: {
          orders: orders.length,
          products: products.length,
          clients: clients.length,
          purchaseBills: purchaseBills.length,
          expenses: expenses.length,
        },
      },
      users, parties, products, productGroups,
      purchaseBills, purchaseItems, partyPayments,
      orders, orderEntries, orderEntryItems,
      clients, ledger, expenses,
      exportReturns, exportReturnItems, invoiceSequences,
    };

    const today = new Date().toISOString().slice(0, 10);
    const filename = `backup-${today}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2), "utf-8");

    // Clean backups older than 30 days
    const allBackups = fs
      .readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith("backup-") && f.endsWith(".json"))
      .sort((a, b) => b.localeCompare(a));

    const toDelete = allBackups.slice(MAX_BACKUPS);
    toDelete.forEach(f => {
      try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch { /* ignore */ }
    });

    const stat = fs.statSync(filepath);

    return NextResponse.json({
      ok: true,
      filename,
      sizeMB: +(stat.size / (1024 * 1024)).toFixed(2),
      deletedOld: toDelete,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Backup Cron] Error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
