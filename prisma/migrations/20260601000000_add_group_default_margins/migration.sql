-- Group-level default selling margins. Products in a group inherit these
-- unless they have their own minMargin/maxMargin override.
-- IF NOT EXISTS keeps this idempotent: it was already applied manually to the
-- existing database, and creates the columns on any fresh database.
ALTER TABLE "ProductGroup"
  ADD COLUMN IF NOT EXISTS "defaultMinMargin" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "defaultMaxMargin" DOUBLE PRECISION;
