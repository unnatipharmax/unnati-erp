import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export type CompanySettings = {
  name: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  indiamart: string;
  marketing: string;
  gstin: string;
  iec: string;
  drugLic: string;
  chaName: string;
  chaNo: string;
  stampB64: string;
  sigB64: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bankBranch: string;
  bankSwift: string;
};

// These are the real defaults for this company — used only if DB is empty and file is missing
const DEFAULTS: CompanySettings = {
  name:       "UNNATI PHARMAX",
  address:    "1/04 Guruvanada Appartment, Central Ave, Lakadganj, Nagpur 440008",
  email:      "unnatipharmax@gmail.com",
  phone:      "",
  website:    "www.unnatipharma.com",
  indiamart:  "www.medshopy.com",
  marketing:  "medindiadropshipper.com",
  gstin:      "27FNXPP3883B1ZA",
  iec:        "FNXPP3883B",
  drugLic:    "MH-NB-152878",
  chaName:    "AARPEE CLEARING & LOGISTICS",
  chaNo:      "11/2623",
  stampB64:   "",
  sigB64:     "",
  bankName:   "ICICI BANK",
  bankAccount:"146305501090",
  bankIfsc:   "",
  bankBranch: "Pushpak Plaza, New Itwari Road, Near Gandhi Putla, Nagpur - 440018",
  bankSwift:  "ICICINBBXXX",
};

const FILE_PATH = path.join(process.cwd(), "data", "company-settings.json");

function readFromFile(): CompanySettings | null {
  try {
    const raw = fs.readFileSync(FILE_PATH, "utf-8");
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

function toSettings(row: Record<string, unknown>): CompanySettings {
  return {
    name:        String(row.name        ?? DEFAULTS.name),
    address:     String(row.address     ?? DEFAULTS.address),
    email:       String(row.email       ?? DEFAULTS.email),
    phone:       String(row.phone       ?? DEFAULTS.phone),
    website:     String(row.website     ?? DEFAULTS.website),
    indiamart:   String(row.indiamart   ?? DEFAULTS.indiamart),
    marketing:   String(row.marketing   ?? DEFAULTS.marketing),
    gstin:       String(row.gstin       ?? DEFAULTS.gstin),
    iec:         String(row.iec         ?? DEFAULTS.iec),
    drugLic:     String(row.drugLic     ?? DEFAULTS.drugLic),
    chaName:     String(row.chaName     ?? DEFAULTS.chaName),
    chaNo:       String(row.chaNo       ?? DEFAULTS.chaNo),
    stampB64:    String(row.stampB64    ?? ""),
    sigB64:      String(row.sigB64      ?? ""),
    bankName:    String(row.bankName    ?? DEFAULTS.bankName),
    bankAccount: String(row.bankAccount ?? DEFAULTS.bankAccount),
    bankIfsc:    String(row.bankIfsc    ?? DEFAULTS.bankIfsc),
    bankBranch:  String(row.bankBranch  ?? DEFAULTS.bankBranch),
    bankSwift:   String(row.bankSwift   ?? DEFAULTS.bankSwift),
  };
}

// Seed DB with the provided settings (best-effort, fire-and-forget)
function seedDb(settings: CompanySettings) {
  prisma.companySetting.upsert({
    where:  { id: "1" },
    update: settings,
    create: { id: "1", ...settings },
  }).catch(() => {/* ignore — will retry on next request */});
}

export async function GET() {
  // 1. Try DB (primary source after migration)
  try {
    const row = await prisma.companySetting.findUnique({ where: { id: "1" } });
    if (row) {
      return NextResponse.json(toSettings(row as Record<string, unknown>));
    }
    // Table exists but row missing — seed it from file or defaults, then return
    const seed = readFromFile() ?? DEFAULTS;
    seedDb(seed);
    return NextResponse.json(seed);
  } catch {
    // Table not created yet (migration pending) — fall through to file
  }

  // 2. Fall back to local JSON file (local dev / pre-migration)
  const fromFile = readFromFile();
  if (fromFile) return NextResponse.json(fromFile);

  // 3. Hard-coded defaults (always have real bank data)
  return NextResponse.json(DEFAULTS);
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  let current: CompanySettings = DEFAULTS;
  try {
    const row = await prisma.companySetting.findUnique({ where: { id: "1" } });
    if (row) current = toSettings(row as Record<string, unknown>);
    else current = readFromFile() ?? DEFAULTS;
  } catch {
    current = readFromFile() ?? DEFAULTS;
  }

  const updated: CompanySettings = {
    name:        String(body.name        ?? current.name).trim(),
    address:     String(body.address     ?? current.address).trim(),
    email:       String(body.email       ?? current.email).trim(),
    phone:       String(body.phone       ?? current.phone).trim(),
    website:     String(body.website     ?? current.website).trim(),
    indiamart:   String(body.indiamart   ?? current.indiamart).trim(),
    marketing:   String(body.marketing   ?? current.marketing).trim(),
    gstin:       String(body.gstin       ?? current.gstin).trim(),
    iec:         String(body.iec         ?? current.iec).trim(),
    drugLic:     String(body.drugLic     ?? current.drugLic).trim(),
    chaName:     String(body.chaName     ?? current.chaName).trim(),
    chaNo:       String(body.chaNo       ?? current.chaNo).trim(),
    stampB64:    body.stampB64 !== undefined ? String(body.stampB64) : current.stampB64,
    sigB64:      body.sigB64   !== undefined ? String(body.sigB64)   : current.sigB64,
    bankName:    String(body.bankName    ?? current.bankName).trim(),
    bankAccount: String(body.bankAccount ?? current.bankAccount).trim(),
    bankIfsc:    String(body.bankIfsc    ?? current.bankIfsc).trim(),
    bankBranch:  String(body.bankBranch  ?? current.bankBranch).trim(),
    bankSwift:   String(body.bankSwift   ?? current.bankSwift).trim(),
  };

  try {
    const row = await prisma.companySetting.upsert({
      where:  { id: "1" },
      update: updated,
      create: { id: "1", ...updated },
    });
    return NextResponse.json(toSettings(row as Record<string, unknown>));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Failed to save company settings:", msg);
    return NextResponse.json({ error: `Save failed: ${msg}` }, { status: 500 });
  }
}
