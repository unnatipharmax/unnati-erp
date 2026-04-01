import { randomUUID } from "crypto";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";

const MAX_PRESCRIPTION_SIZE_BYTES = 10 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "prescriptions");

const MIME_EXTENSION_MAP: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp"]);

export type SavedPrescription = {
  originalName: string;
  storedName: string;
  mimeType: string;
};

type PendingPrescription = SavedPrescription & {
  bytes: Buffer;
};

export function sanitizeDownloadName(value: string) {
  const trimmed = value.trim();
  const cleaned = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return cleaned || "prescription";
}

function getFileExtension(file: File) {
  const fromName = path.extname(file.name || "").toLowerCase();
  if (fromName) return fromName;
  return MIME_EXTENSION_MAP[file.type] ?? "";
}

export async function preparePrescriptionUpload(
  entry: FormDataEntryValue | null
): Promise<PendingPrescription | null> {
  if (!(entry instanceof File) || entry.size === 0) {
    return null;
  }

  if (entry.size > MAX_PRESCRIPTION_SIZE_BYTES) {
    throw new Error("Prescription file must be 10 MB or smaller");
  }

  const extension = getFileExtension(entry);
  if (!extension || !ALLOWED_EXTENSIONS.has(extension.toLowerCase())) {
    throw new Error("Prescription must be a PDF, JPG, PNG, or WEBP file");
  }

  const bytes = Buffer.from(await entry.arrayBuffer());
  const storedName = `${randomUUID()}${extension}`;

  return {
    originalName: sanitizeDownloadName(entry.name || `prescription${extension}`),
    storedName,
    mimeType: entry.type || "application/octet-stream",
    bytes,
  };
}

export async function savePrescriptionUpload(
  pending: PendingPrescription
): Promise<SavedPrescription> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, pending.storedName), pending.bytes);

  return {
    originalName: pending.originalName,
    storedName: pending.storedName,
    mimeType: pending.mimeType,
  };
}

export async function deletePrescriptionUpload(storedName: string | null | undefined) {
  if (!storedName) return;
  await rm(path.join(UPLOAD_DIR, storedName), { force: true });
}

export function getPrescriptionAbsolutePath(storedName: string) {
  return path.join(UPLOAD_DIR, storedName);
}
