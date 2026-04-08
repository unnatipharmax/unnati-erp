-- Add net and gross weight fields to OrderInitiation for DHL shipments
ALTER TABLE "OrderInitiation" ADD COLUMN IF NOT EXISTS "netWeight" DOUBLE PRECISION;
ALTER TABLE "OrderInitiation" ADD COLUMN IF NOT EXISTS "grossWeight" DOUBLE PRECISION;
