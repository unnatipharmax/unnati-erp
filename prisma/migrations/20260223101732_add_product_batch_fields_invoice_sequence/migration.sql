/*
  Warnings:

  - A unique constraint covering the columns `[invoiceNo]` on the table `OrderInitiation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "OrderInitiation" ADD COLUMN     "invoiceGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "invoiceNo" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "batchNo" TEXT,
ADD COLUMN     "composition" TEXT,
ADD COLUMN     "expDate" TEXT,
ADD COLUMN     "mfgDate" TEXT;

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "id" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSequence_financialYear_key" ON "InvoiceSequence"("financialYear");

-- CreateIndex
CREATE UNIQUE INDEX "OrderInitiation_invoiceNo_key" ON "OrderInitiation"("invoiceNo");

-- CreateIndex
CREATE INDEX "OrderInitiation_invoiceNo_idx" ON "OrderInitiation"("invoiceNo");
