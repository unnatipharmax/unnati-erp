-- AlterTable
ALTER TABLE "OrderInitiation" ADD COLUMN     "dollarAmount" DECIMAL(12,2),
ADD COLUMN     "exchangeRate" DECIMAL(10,4),
ADD COLUMN     "grsNumber" TEXT,
ADD COLUMN     "inrAmount" DECIMAL(12,2),
ADD COLUMN     "paymentDepositDate" TIMESTAMP(3);
