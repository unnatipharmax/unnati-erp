-- CreateTable
CREATE TABLE "CompanySetting" (
    "id"          TEXT NOT NULL DEFAULT '1',
    "name"        TEXT NOT NULL DEFAULT 'UNNATI PHARMAX',
    "address"     TEXT NOT NULL DEFAULT '',
    "email"       TEXT NOT NULL DEFAULT '',
    "phone"       TEXT NOT NULL DEFAULT '',
    "website"     TEXT NOT NULL DEFAULT '',
    "indiamart"   TEXT NOT NULL DEFAULT '',
    "marketing"   TEXT NOT NULL DEFAULT '',
    "gstin"       TEXT NOT NULL DEFAULT '',
    "iec"         TEXT NOT NULL DEFAULT '',
    "drugLic"     TEXT NOT NULL DEFAULT '',
    "chaName"     TEXT NOT NULL DEFAULT '',
    "chaNo"       TEXT NOT NULL DEFAULT '',
    "stampB64"    TEXT NOT NULL DEFAULT '',
    "sigB64"      TEXT NOT NULL DEFAULT '',
    "bankName"    TEXT NOT NULL DEFAULT '',
    "bankAccount" TEXT NOT NULL DEFAULT '',
    "bankIfsc"    TEXT NOT NULL DEFAULT '',
    "bankBranch"  TEXT NOT NULL DEFAULT '',
    "bankSwift"   TEXT NOT NULL DEFAULT '',
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySetting_pkey" PRIMARY KEY ("id")
);

-- Seed the single settings row with current values
INSERT INTO "CompanySetting" (
    "id","name","address","email","phone","website","indiamart","marketing",
    "gstin","iec","drugLic","chaName","chaNo",
    "stampB64","sigB64",
    "bankName","bankAccount","bankIfsc","bankBranch","bankSwift","updatedAt"
) VALUES (
    '1',
    'UNNATI PHARMAX',
    '1/04 Guruvanada Appartment, Central Ave, Lakadganj, Nagpur 440008',
    'unnatipharmax@gmail.com',
    '',
    'www.unnatipharma.com',
    'www.medshopy.com',
    'medindiadropshipper.com',
    '27FNXPP3883B1ZA',
    'FNXPP3883B',
    'MH-NB-152878',
    'AARPEE CLEARING & LOGISTICS',
    '11/2623',
    '',
    '',
    'ICICI BANK',
    '146305501090',
    '',
    'Pushpak Plaza, New Itwari Road, Near Gandhi Putla, Nagpur - 440018',
    'ICICINBBXXX',
    NOW()
) ON CONFLICT ("id") DO NOTHING;
