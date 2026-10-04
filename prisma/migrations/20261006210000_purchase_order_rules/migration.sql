-- A receipt that is undone gets its own stock movement kind.
ALTER TYPE "StockMovementKind" ADD VALUE 'RECEIPT_REVERSED';

-- Purchase order numbers: PO-0001 per company, existing ones numbered in
-- the order they were created; the company counter continues from there.
ALTER TABLE "Company" ADD COLUMN "purchaseOrderSeq" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseOrder" ADD COLUMN "poNumber" TEXT;

UPDATE "PurchaseOrder" p
SET "poNumber" = 'PO-' || CASE WHEN r.n < 10000 THEN lpad(r.n::text, 4, '0') ELSE r.n::text END
FROM (
  SELECT id, row_number() OVER (PARTITION BY "companyId" ORDER BY "createdAt", id) AS n
  FROM "PurchaseOrder"
) r
WHERE p.id = r.id;

UPDATE "Company" c
SET "purchaseOrderSeq" = (SELECT count(*) FROM "PurchaseOrder" p WHERE p."companyId" = c.id);

ALTER TABLE "PurchaseOrder" ALTER COLUMN "poNumber" SET NOT NULL;
CREATE UNIQUE INDEX "PurchaseOrder_companyId_poNumber_key" ON "PurchaseOrder"("companyId", "poNumber");

-- Deleting a supplier no longer deletes their purchase orders: it is refused
-- while they have any.
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_supplierId_fkey";
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
