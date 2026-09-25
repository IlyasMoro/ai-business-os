-- CreateEnum
CREATE TYPE "TrackingMode" AS ENUM ('NONE', 'LOT', 'SERIAL');

-- CreateEnum
CREATE TYPE "PickingRule" AS ENUM ('FIFO', 'FEFO');

-- CreateEnum
CREATE TYPE "LotMovementKind" AS ENUM ('RECEIPT', 'SALE', 'CONSUMPTION', 'PRODUCTION', 'RETURN', 'OPENING');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "trackingMode" "TrackingMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "tracksExpiry" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StockLot" (
    "id" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "workOrderId" TEXT,
    "productId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotMovement" (
    "id" TEXT NOT NULL,
    "kind" "LotMovementKind" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lotId" TEXT NOT NULL,
    "orderId" TEXT,
    "purchaseOrderId" TEXT,
    "workOrderId" TEXT,
    "returnId" TEXT,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "LotMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySettings" (
    "id" TEXT NOT NULL,
    "pickingRule" "PickingRule" NOT NULL DEFAULT 'FIFO',
    "blockExpired" BOOLEAN NOT NULL DEFAULT true,
    "expiryWarningDays" INTEGER NOT NULL DEFAULT 30,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "InventorySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockLot_companyId_idx" ON "StockLot"("companyId");

-- CreateIndex
CREATE INDEX "StockLot_companyId_expiresAt_idx" ON "StockLot"("companyId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockLot_productId_lotNumber_key" ON "StockLot"("productId", "lotNumber");

-- CreateIndex
CREATE INDEX "LotMovement_lotId_idx" ON "LotMovement"("lotId");

-- CreateIndex
CREATE INDEX "LotMovement_companyId_idx" ON "LotMovement"("companyId");

-- CreateIndex
CREATE INDEX "LotMovement_orderId_idx" ON "LotMovement"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySettings_companyId_key" ON "InventorySettings"("companyId");

-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotMovement" ADD CONSTRAINT "LotMovement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "StockLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotMovement" ADD CONSTRAINT "LotMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySettings" ADD CONSTRAINT "InventorySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

