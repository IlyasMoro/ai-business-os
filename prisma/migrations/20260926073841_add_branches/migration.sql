-- AlterTable
ALTER TABLE "CostCenter" ADD COLUMN     "branchId" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "branchId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "branchId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "branchId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "branchId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "branchId" TEXT;

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Branch_companyId_idx" ON "Branch"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_companyId_code_key" ON "Branch"("companyId", "code");

-- CreateIndex
CREATE INDEX "CostCenter_branchId_idx" ON "CostCenter"("branchId");

-- CreateIndex
CREATE INDEX "Employee_branchId_idx" ON "Employee"("branchId");

-- CreateIndex
CREATE INDEX "Invoice_branchId_idx" ON "Invoice"("branchId");

-- CreateIndex
CREATE INDEX "Order_branchId_idx" ON "Order"("branchId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_branchId_idx" ON "PurchaseOrder"("branchId");

-- CreateIndex
CREATE INDEX "User_branchId_idx" ON "User"("branchId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every existing company gets a Main branch, and its existing
-- orders, invoices, purchase orders and employees move into it. Users stay
-- NULL (access to every branch), so nobody loses access. Written by hand.
INSERT INTO "Branch" ("id", "name", "code", "isMain", "companyId")
SELECT 'br' || substr(md5(random()::text || c."id"), 1, 23), 'Main branch', 'MAIN', true, c."id"
FROM "Company" c
WHERE NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."companyId" = c."id" AND b."isMain");

UPDATE "Order" o SET "branchId" = b."id"
FROM "Branch" b WHERE b."companyId" = o."companyId" AND b."isMain" AND o."branchId" IS NULL;

UPDATE "Invoice" i SET "branchId" = b."id"
FROM "Branch" b WHERE b."companyId" = i."companyId" AND b."isMain" AND i."branchId" IS NULL;

UPDATE "PurchaseOrder" p SET "branchId" = b."id"
FROM "Branch" b WHERE b."companyId" = p."companyId" AND b."isMain" AND p."branchId" IS NULL;

UPDATE "Employee" e SET "branchId" = b."id"
FROM "Branch" b WHERE b."companyId" = e."companyId" AND b."isMain" AND e."branchId" IS NULL;
