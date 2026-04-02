-- AlterTable: add qty and unitType columns to Product
ALTER TABLE "Product" ADD COLUMN "qty"      INTEGER;
ALTER TABLE "Product" ADD COLUMN "unitType" TEXT;
