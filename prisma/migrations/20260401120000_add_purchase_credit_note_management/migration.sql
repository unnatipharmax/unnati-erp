-- CreateEnum
CREATE TYPE "PurchaseDocumentType" AS ENUM ('BILL', 'CREDIT_NOTE');

-- AlterTable
ALTER TABLE "PurchaseBill"
ADD COLUMN "documentType" "PurchaseDocumentType" NOT NULL DEFAULT 'BILL';

-- CreateTable
CREATE TABLE "PurchaseCreditNoteAllocation" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseCreditNoteAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseBill_partyId_documentType_idx" ON "PurchaseBill"("partyId", "documentType");

-- CreateIndex
CREATE INDEX "PurchaseCreditNoteAllocation_creditNoteId_idx" ON "PurchaseCreditNoteAllocation"("creditNoteId");

-- CreateIndex
CREATE INDEX "PurchaseCreditNoteAllocation_billId_idx" ON "PurchaseCreditNoteAllocation"("billId");

-- AddForeignKey
ALTER TABLE "PurchaseCreditNoteAllocation"
ADD CONSTRAINT "PurchaseCreditNoteAllocation_creditNoteId_fkey"
FOREIGN KEY ("creditNoteId") REFERENCES "PurchaseBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseCreditNoteAllocation"
ADD CONSTRAINT "PurchaseCreditNoteAllocation_billId_fkey"
FOREIGN KEY ("billId") REFERENCES "PurchaseBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
