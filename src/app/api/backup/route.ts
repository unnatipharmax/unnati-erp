import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../lib/auth";
import { prisma as db } from "../../../lib/prisma";
import fs from "fs";
import path from "path";

const BACKUP_DIR = path.join(process.cwd(), "backups");
const MAX_BACKUPS = 30; // keep last 30 days

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// ── GET: list all backups ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  ensureBackupDir();

  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith("backup-") && f.endsWith(".json"))
    .map(f => {
      const fullPath = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(fullPath);
      return {
        filename: f,
        date: f.replace("backup-", "").replace(".json", ""),
        sizeBytes: stat.size,
        sizeMB: +(stat.size / (1024 * 1024)).toFixed(2),
        createdAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date)); // newest first

  return NextResponse.json({ backups: files, backupDir: BACKUP_DIR });
}

// ── POST: create a new backup + auto-clean old ones ───────────────────────────
export async function POST(req: NextRequest) {
  // Allow internal cron call (no session) OR admin session
  const authHeader = req.headers.get("x-cron-secret");
  const isCron = authHeader === process.env.CRON_SECRET;

  if (!isCron) {
    const session = await getSession();
    if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  ensureBackupDir();

  // ── Fetch all tables ──────────────────────────────────────────────────────
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
    clientLinks,
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
    db.clientAccountLink.findMany(),
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
      exportedBy: "Unnati Pharmax ERP Auto-Backup",
      counts: {
        users: users.length,
        parties: parties.length,
        products: products.length,
        purchaseBills: purchaseBills.length,
        orders: orders.length,
        clients: clients.length,
        ledger: ledger.length,
        expenses: expenses.length,
        exportReturns: exportReturns.length,
      },
    },
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
    clientLinks,
    ledger,
    expenses,
    exportReturns,
    exportReturnItems,
    invoiceSequences,
  };

  // ── Write backup file ─────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `backup-${today}.json`;
  const filepath = path.join(BACKUP_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2), "utf-8");

  // ── Clean up backups older than MAX_BACKUPS days ──────────────────────────
  const allBackups = fs
    .readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith("backup-") && f.endsWith(".json"))
    .sort((a, b) => b.localeCompare(a)); // newest first

  const toDelete = allBackups.slice(MAX_BACKUPS);
  toDelete.forEach(f => {
    try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch { /* ignore */ }
  });

  const stat = fs.statSync(filepath);

  return NextResponse.json({
    success: true,
    filename,
    sizeMB: +(stat.size / (1024 * 1024)).toFixed(2),
    deletedOld: toDelete,
    totalBackups: allBackups.length - toDelete.length,
  });
}

// ── DELETE: manually delete a specific backup ─────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename } = await req.json() as { filename: string };

  // Safety: only allow deleting files matching expected pattern
  if (!filename || !/^backup-\d{4}-\d{2}-\d{2}\.json$/.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filepath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  fs.unlinkSync(filepath);
  return NextResponse.json({ success: true });
}
