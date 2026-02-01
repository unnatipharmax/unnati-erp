-- CreateTable
CREATE TABLE "ClientFormLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "usedAt" TIMESTAMP(3),
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientFormLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientFormLink_token_key" ON "ClientFormLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ClientFormLink_orderId_key" ON "ClientFormLink"("orderId");

-- CreateIndex
CREATE INDEX "ClientFormLink_isUsed_idx" ON "ClientFormLink"("isUsed");

-- CreateIndex
CREATE INDEX "ClientFormLink_expiresAt_idx" ON "ClientFormLink"("expiresAt");

-- AddForeignKey
ALTER TABLE "ClientFormLink" ADD CONSTRAINT "ClientFormLink_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderInitiation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
