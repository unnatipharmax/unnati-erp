import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const SETTINGS_PATH = path.join(process.cwd(), "data", "company-settings.json");

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
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bankBranch: string;
  bankSwift: string;
};

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
  bankName:   "",
  bankAccount:"",
  bankIfsc:   "",
  bankBranch: "",
  bankSwift:  "",
};

function readSettings(): CompanySettings {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function GET() {
  return NextResponse.json(readSettings());
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const current = readSettings();
  const updated: CompanySettings = {
    name:        (body.name        ?? current.name).trim(),
    address:     (body.address     ?? current.address).trim(),
    email:       (body.email       ?? current.email).trim(),
    phone:       (body.phone       ?? current.phone).trim(),
    website:     (body.website     ?? current.website).trim(),
    indiamart:   (body.indiamart   ?? current.indiamart).trim(),
    marketing:   (body.marketing   ?? current.marketing).trim(),
    gstin:       (body.gstin       ?? current.gstin).trim(),
    iec:         (body.iec         ?? current.iec).trim(),
    drugLic:     (body.drugLic     ?? current.drugLic).trim(),
    bankName:    (body.bankName    ?? current.bankName).trim(),
    bankAccount: (body.bankAccount ?? current.bankAccount).trim(),
    bankIfsc:    (body.bankIfsc    ?? current.bankIfsc).trim(),
    bankBranch:  (body.bankBranch  ?? current.bankBranch).trim(),
    bankSwift:   (body.bankSwift   ?? current.bankSwift).trim(),
  };

  // Ensure data dir exists
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2), "utf-8");
  return NextResponse.json(updated);
}
