-- Sales order numbers: SO-0001 per company, existing orders numbered in the
-- order they were created. The company counter continues from there.
ALTER TABLE "Company" ADD COLUMN "orderSeq" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "orderNumber" TEXT;

UPDATE "Order" o
SET "orderNumber" = 'SO-' || CASE WHEN r.n < 10000 THEN lpad(r.n::text, 4, '0') ELSE r.n::text END
FROM (
  SELECT id, row_number() OVER (PARTITION BY "companyId" ORDER BY "createdAt", id) AS n
  FROM "Order"
) r
WHERE o.id = r.id;

UPDATE "Company" c
SET "orderSeq" = (SELECT count(*) FROM "Order" o WHERE o."companyId" = c.id);

ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Order_companyId_orderNumber_key" ON "Order"("companyId", "orderNumber");
