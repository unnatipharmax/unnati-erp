-- ─────────────────────────────────────────────────────────────────────────────
-- Multi-company Stage 1: foundation only. Adds new CompanySetting fields and a
-- nullable companyId to every business table, seeds Company #1 (id="1") from the
-- existing single-row settings, and backfills all existing rows to it.
-- ZERO behavior change: companyId stays nullable; existing queries are unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. New CompanySetting fields (per-company logo, invoice prefix, active flag, createdAt)
ALTER TABLE "CompanySetting" ADD COLUMN IF NOT EXISTS "logoB64" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySetting" ADD COLUMN IF NOT EXISTS "invoicePrefix" TEXT NOT NULL DEFAULT 'E';
ALTER TABLE "CompanySetting" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CompanySetting" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 2. Ensure Company #1 exists (the current company). If the settings row is missing,
--    create a minimal UNNATI PHARMAX row so backfill has a target. updatedAt is
--    app-managed (@updatedAt) with no DB default, so it must be set explicitly here.
INSERT INTO "CompanySetting" ("id", "name", "updatedAt")
VALUES ('1', 'UNNATI PHARMAX', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- 3. Add nullable companyId to every business table
ALTER TABLE "OrderInitiation" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Product"         ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "ProductGroup"    ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "PurchaseBill"    ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "PurchaseItem"    ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Party"           ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "PartyPayment"    ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "ClientAccount"   ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Expense"         ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "AccountLedger"   ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "ExportReturn"    ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "ClientFormLink"  ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "InvoiceSequence" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

-- 4. Backfill all existing rows to Company #1
UPDATE "OrderInitiation" SET "companyId" = '1' WHERE "companyId" IS NULL;
UPDATE "Product"         SET "companyId" = '1' WHERE "companyId" IS NULL;
UPDATE "ProductGroup"    SET "companyId" = '1' WHERE "companyId" IS NULL;
UPDATE "PurchaseBill"    SET "companyId" = '1' WHERE "companyId" IS NULL;
UPDATE "PurchaseItem"    SET "companyId" = '1' WHERE "companyId" IS NULL;
UPDATE "Party"           SET "companyId" = '1' WHERE "companyId" IS NULL;
UPDATE "PartyPayment"    SET "companyId" = '1' WHERE "companyId" IS NULL;
UPDATE "ClientAccount"   SET "companyId" = '1' WHERE "companyId" IS NULL;
UPDATE "Expense"         SET "companyId" = '1' WHERE "companyId" IS NULL;
UPDATE "AccountLedger"   SET "companyId" = '1' WHERE "companyId" IS NULL;
UPDATE "ExportReturn"    SET "companyId" = '1' WHERE "companyId" IS NULL;
UPDATE "ClientFormLink"  SET "companyId" = '1' WHERE "companyId" IS NULL;
UPDATE "InvoiceSequence" SET "companyId" = '1' WHERE "companyId" IS NULL;

-- 5. InvoiceSequence: swap single-column unique for (companyId, financialYear)
DROP INDEX IF EXISTS "InvoiceSequence_financialYear_key";
CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceSequence_companyId_financialYear_key"
  ON "InvoiceSequence" ("companyId", "financialYear");

-- 6. Indexes on companyId
CREATE INDEX IF NOT EXISTS "OrderInitiation_companyId_idx" ON "OrderInitiation" ("companyId");
CREATE INDEX IF NOT EXISTS "Product_companyId_idx"         ON "Product" ("companyId");
CREATE INDEX IF NOT EXISTS "ProductGroup_companyId_idx"    ON "ProductGroup" ("companyId");
CREATE INDEX IF NOT EXISTS "PurchaseBill_companyId_idx"    ON "PurchaseBill" ("companyId");
CREATE INDEX IF NOT EXISTS "PurchaseItem_companyId_idx"    ON "PurchaseItem" ("companyId");
CREATE INDEX IF NOT EXISTS "Party_companyId_idx"           ON "Party" ("companyId");
CREATE INDEX IF NOT EXISTS "PartyPayment_companyId_idx"    ON "PartyPayment" ("companyId");
CREATE INDEX IF NOT EXISTS "ClientAccount_companyId_idx"   ON "ClientAccount" ("companyId");
CREATE INDEX IF NOT EXISTS "Expense_companyId_idx"         ON "Expense" ("companyId");
CREATE INDEX IF NOT EXISTS "AccountLedger_companyId_idx"   ON "AccountLedger" ("companyId");
CREATE INDEX IF NOT EXISTS "ExportReturn_companyId_idx"    ON "ExportReturn" ("companyId");
CREATE INDEX IF NOT EXISTS "ClientFormLink_companyId_idx"  ON "ClientFormLink" ("companyId");
CREATE INDEX IF NOT EXISTS "InvoiceSequence_companyId_idx" ON "InvoiceSequence" ("companyId");

-- 7. Foreign keys → CompanySetting (nullable, so existing/backfilled rows are fine).
--    Guarded so a partial re-run won't error on already-existing constraints.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['OrderInitiation','Product','ProductGroup','PurchaseBill','PurchaseItem','Party','PartyPayment','ClientAccount','Expense','AccountLedger','ExportReturn','ClientFormLink','InvoiceSequence'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_companyId_fkey') THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("companyId") REFERENCES "CompanySetting"("id") ON DELETE SET NULL ON UPDATE CASCADE',
        t, t || '_companyId_fkey'
      );
    END IF;
  END LOOP;
END $$;
