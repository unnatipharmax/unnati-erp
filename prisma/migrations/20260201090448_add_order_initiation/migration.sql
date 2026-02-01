-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('CLIENT', 'SALES');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('INITIATED', 'SALES_UPDATED', 'PAYMENT_VERIFIED', 'PACKING', 'DISPATCHED');

-- CreateTable
CREATE TABLE "OrderInitiation" (
    "id" TEXT NOT NULL,
    "source" "OrderSource" NOT NULL,
    "filledByUserId" TEXT,
    "clientFormToken" TEXT,
    "fullName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "remitterName" TEXT NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'INITIATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderInitiation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderInitiation_status_idx" ON "OrderInitiation"("status");

-- CreateIndex
CREATE INDEX "OrderInitiation_email_idx" ON "OrderInitiation"("email");
