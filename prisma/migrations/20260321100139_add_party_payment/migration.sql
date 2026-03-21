-- CreateTable
CREATE TABLE "PartyPayment" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "billId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartyPayment_partyId_idx" ON "PartyPayment"("partyId");

-- CreateIndex
CREATE INDEX "PartyPayment_billId_idx" ON "PartyPayment"("billId");

-- AddForeignKey
ALTER TABLE "PartyPayment" ADD CONSTRAINT "PartyPayment_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPayment" ADD CONSTRAINT "PartyPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "PurchaseBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
