-- Stock per branch. Product.stockQty stays as the company total and every
-- existing unit (and lot) moves into its company's Main branch.

-- Safety net: any company still without a main branch gets one.
INSERT INTO "Branch" ("id", "name", "code", "isMain", "companyId")
SELECT 'br' || substr(md5(random()::text || c."id"), 1, 23), 'Main branch', 'MAIN', true, c."id"
FROM "Company" c
WHERE NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."companyId" = c."id" AND b."isMain");

-- CreateTable
CREATE TABLE "BranchStock" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER,
    "productId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "BranchStock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BranchStock_companyId_idx" ON "BranchStock"("companyId");
CREATE INDEX "BranchStock_productId_idx" ON "BranchStock"("productId");
CREATE UNIQUE INDEX "BranchStock_branchId_productId_key" ON "BranchStock"("branchId", "productId");

ALTER TABLE "BranchStock" ADD CONSTRAINT "BranchStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchStock" ADD CONSTRAINT "BranchStock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchStock" ADD CONSTRAINT "BranchStock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every product's stock sits at its company's Main branch.
INSERT INTO "BranchStock" ("id", "quantity", "productId", "branchId", "companyId")
SELECT 'bs' || substr(md5(random()::text || p."id"), 1, 23), p."stockQty", p."id", b."id", p."companyId"
FROM "Product" p
JOIN "Branch" b ON b."companyId" = p."companyId" AND b."isMain";

-- Lots: add the column, fill it with the Main branch, then require it.
ALTER TABLE "StockLot" ADD COLUMN "branchId" TEXT;

UPDATE "StockLot" l SET "branchId" = b."id"
FROM "Branch" b WHERE b."companyId" = l."companyId" AND b."isMain";

ALTER TABLE "StockLot" ALTER COLUMN "branchId" SET NOT NULL;

DROP INDEX "StockLot_productId_lotNumber_key";
CREATE INDEX "StockLot_branchId_idx" ON "StockLot"("branchId");
CREATE UNIQUE INDEX "StockLot_productId_branchId_lotNumber_key" ON "StockLot"("productId", "branchId", "lotNumber");

ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
