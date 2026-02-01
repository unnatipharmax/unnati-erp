/*
  Warnings:

  - You are about to drop the column `productName` on the `OrderEntryItem` table. All the data in the column will be lost.
  - Added the required column `productId` to the `OrderEntryItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OrderEntryItem" DROP COLUMN "productName",
ADD COLUMN     "productId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "OrderEntryItem_productId_idx" ON "OrderEntryItem"("productId");

-- AddForeignKey
ALTER TABLE "OrderEntryItem" ADD CONSTRAINT "OrderEntryItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
