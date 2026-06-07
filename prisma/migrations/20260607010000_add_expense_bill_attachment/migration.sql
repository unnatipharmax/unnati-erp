-- Bill attachment fields on Expense (audit proof)
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "billOriginalName" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "billStoredName" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "billMimeType" TEXT;
