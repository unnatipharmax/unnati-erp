-- CreateEnum
CREATE TYPE "ShipmentMode" AS ENUM ('EMS', 'ITPS', 'RMS', 'DHL');

-- CreateTable
CREATE TABLE "OrderEntry" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shippingPrice" DECIMAL(12,2) NOT NULL,
    "shipmentMode" "ShipmentMode" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEntryItem" (
    "id" TEXT NOT NULL,
    "orderEntryId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sellingPrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEntryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderEntry_orderId_key" ON "OrderEntry"("orderId");

-- CreateIndex
CREATE INDEX "OrderEntryItem_orderEntryId_idx" ON "OrderEntryItem"("orderEntryId");

-- AddForeignKey
ALTER TABLE "OrderEntry" ADD CONSTRAINT "OrderEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderInitiation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEntryItem" ADD CONSTRAINT "OrderEntryItem_orderEntryId_fkey" FOREIGN KEY ("orderEntryId") REFERENCES "OrderEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
