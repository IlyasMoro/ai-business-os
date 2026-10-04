-- CreateEnum
CREATE TYPE "CostMethod" AS ENUM ('MANUAL', 'LAST_PRICE', 'AVERAGE');

-- AlterTable
ALTER TABLE "InventorySettings" ADD COLUMN     "costMethod" "CostMethod" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "purchaseOrderId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_purchaseOrderId_idx" ON "Transaction"("purchaseOrderId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

