-- Per-company quotation number sequence (incremented only when a quote is printed).
CREATE TABLE IF NOT EXISTS "QuoteSequence" (
  "id"         TEXT NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 0,
  "companyId"  TEXT,
  CONSTRAINT "QuoteSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "QuoteSequence_companyId_key" ON "QuoteSequence" ("companyId");
CREATE INDEX IF NOT EXISTS "QuoteSequence_companyId_idx" ON "QuoteSequence" ("companyId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuoteSequence_companyId_fkey') THEN
    ALTER TABLE "QuoteSequence"
      ADD CONSTRAINT "QuoteSequence_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "CompanySetting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
