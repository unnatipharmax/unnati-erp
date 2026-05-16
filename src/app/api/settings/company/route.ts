import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

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
  bankName:   "",
  bankAccount:"",
  bankIfsc:   "",
  bankBranch: "",
  bankSwift:  "",
};

function toSettings(row: Record<string, unknown> | null): CompanySettings {
  if (!row) return { ...DEFAULTS };
  return {
    name:        (row.name        as string) ?? DEFAULTS.name,
    address:     (row.address     as string) ?? DEFAULTS.address,
    email:       (row.email       as string) ?? DEFAULTS.email,
    phone:       (row.phone       as string) ?? DEFAULTS.phone,
    website:     (row.website     as string) ?? DEFAULTS.website,
    indiamart:   (row.indiamart   as string) ?? DEFAULTS.indiamart,
    marketing:   (row.marketing   as string) ?? DEFAULTS.marketing,
    gstin:       (row.gstin       as string) ?? DEFAULTS.gstin,
    iec:         (row.iec         as string) ?? DEFAULTS.iec,
    drugLic:     (row.drugLic     as string) ?? DEFAULTS.drugLic,
    chaName:     (row.chaName     as string) ?? DEFAULTS.chaName,
    chaNo:       (row.chaNo       as string) ?? DEFAULTS.chaNo,
    stampB64:    (row.stampB64    as string) ?? "",
    sigB64:      (row.sigB64      as string) ?? "",
    bankName:    (row.bankName    as string) ?? "",
    bankAccount: (row.bankAccount as string) ?? "",
    bankIfsc:    (row.bankIfsc    as string) ?? "",
    bankBranch:  (row.bankBranch  as string) ?? "",
    bankSwift:   (row.bankSwift   as string) ?? "",
  };
}

export async function GET() {
  try {
    const row = await prisma.companySetting.findUnique({ where: { id: "1" } });
    return NextResponse.json(toSettings(row as Record<string, unknown> | null));
  } catch {
    return NextResponse.json(DEFAULTS);
  }
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const current = toSettings(
    await prisma.companySetting.findUnique({ where: { id: "1" } }) as Record<string, unknown> | null
  );

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
    stampB64:    body.stampB64  !== undefined ? String(body.stampB64)  : current.stampB64,
    sigB64:      body.sigB64    !== undefined ? String(body.sigB64)    : current.sigB64,
    bankName:    String(body.bankName    ?? current.bankName).trim(),
    bankAccount: String(body.bankAccount ?? current.bankAccount).trim(),
    bankIfsc:    String(body.bankIfsc    ?? current.bankIfsc).trim(),
    bankBranch:  String(body.bankBranch  ?? current.bankBranch).trim(),
    bankSwift:   String(body.bankSwift   ?? current.bankSwift).trim(),
  };

  const row = await prisma.companySetting.upsert({
    where:  { id: "1" },
    update: updated,
    create: { id: "1", ...updated },
  });

  return NextResponse.json(toSettings(row as Record<string, unknown>));
}
