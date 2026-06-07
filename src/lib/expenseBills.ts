import { randomUUID } from "crypto";
import { rm, writeFile } from "fs/promises";
import fs from "fs";
import os from "os";
import path from "path";

const MAX_BILL_SIZE_BYTES = 10 * 1024 * 1024;

function resolveUploadDir(): string {
  const candidates = [
    process.env.EXPENSE_BILL_UPLOAD_DIR,
    path.join(process.cwd(), "uploads", "expense-bills"),
    path.join(os.tmpdir(), "unnati-expense-bills"),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    } catch {
      // try next candidate
    }
  }
  return path.join(os.tmpdir(), "unnati-expense-bills");
}

const UPLOAD_DIR = resolveUploadDir();

const MIME_EXTENSION_MAP: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export type SavedBill = {
  originalName: string;
  storedName: string;
  mimeType: string;
};

// Save a base64 data payload (sent alongside the expense JSON) to disk.
export async function saveExpenseBill(
  base64: string | null | undefined,
  mimeType: string | null | undefined,
  originalName?: string | null
): Promise<SavedBill | null> {
  if (!base64) return null;
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) return null;
  if (bytes.length > MAX_BILL_SIZE_BYTES) throw new Error("Bill image must be 10 MB or smaller");

  const mime = mimeType || "image/jpeg";
  const extension = MIME_EXTENSION_MAP[mime] ?? ".jpg";
  const storedName = `${randomUUID()}${extension}`;
  await writeFile(path.join(UPLOAD_DIR, storedName), bytes);

  const cleanName = (originalName || `bill${extension}`).replace(/[^a-zA-Z0-9._-]+/g, "_") || `bill${extension}`;
  return { originalName: cleanName, storedName, mimeType: mime };
}

export async function deleteExpenseBill(storedName: string | null | undefined) {
  if (!storedName) return;
  await rm(path.join(UPLOAD_DIR, storedName), { force: true });
}

export function getExpenseBillAbsolutePath(storedName: string) {
  return path.join(UPLOAD_DIR, storedName);
}
