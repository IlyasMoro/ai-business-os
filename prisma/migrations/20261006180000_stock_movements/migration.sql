-- CreateEnum
CREATE TYPE "StockMovementKind" AS ENUM ('OPENING', 'ADJUSTMENT', 'RECEIPT', 'SALE', 'SALE_CANCELLED', 'RETURN', 'TRANSFER_OUT', 'TRANSFER_IN', 'PRODUCTION', 'CONSUMPTION');

-- CreateEnum
CREATE TYPE "StockAdjustmentReason" AS ENUM ('COUNT', 'DAMAGED', 'LOST', 'FOUND', 'OTHER');

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "kind" "StockMovementKind" NOT NULL,
    "delta" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "reason" "StockAdjustmentReason",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "orderId" TEXT,
    "purchaseOrderId" TEXT,
    "transferId" TEXT,
    "returnId" TEXT,
    "workOrderId" TEXT,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_branchId_idx" ON "StockMovement"("branchId");

-- CreateIndex
CREATE INDEX "StockMovement_companyId_idx" ON "StockMovement"("companyId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- History starts now: one starting balance per product per branch with the
-- stock on hand, so every product's history adds up from the first row.
INSERT INTO "StockMovement" ("id", "kind", "delta", "quantityAfter", "note", "createdAt", "companyId", "branchId", "productId")
SELECT 'smo_' || replace(gen_random_uuid()::text, '-', ''), 'OPENING', bs."quantity", bs."quantity",
       'Stock on hand when stock history started', (now() AT TIME ZONE 'UTC'), bs."companyId", bs."branchId", bs."productId"
FROM "BranchStock" bs
WHERE bs."quantity" <> 0;
