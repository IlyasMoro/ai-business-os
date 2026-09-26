-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "autoCreated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StockTransfer" ADD COLUMN     "autoCreated" BOOLEAN NOT NULL DEFAULT false;

