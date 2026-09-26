-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "branchId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_branchId_idx" ON "Transaction"("branchId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: invoice payments belong to the invoice's branch; other money
-- follows its cost center's branch when it has one. The rest stays company
-- wide. Written by hand.
UPDATE "Transaction" t SET "branchId" = i."branchId"
FROM "Invoice" i WHERE t."invoiceId" = i."id" AND t."branchId" IS NULL AND i."branchId" IS NOT NULL;

UPDATE "Transaction" t SET "branchId" = c."branchId"
FROM "CostCenter" c WHERE t."costCenterId" = c."id" AND t."branchId" IS NULL AND c."branchId" IS NOT NULL;
