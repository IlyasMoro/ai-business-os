-- Invoice numbers from a per-company counter instead of "count + 1", which
-- collided with the unique number after any invoice was deleted. The
-- counter starts after the highest INV-<n> each company already has.
ALTER TABLE "Company" ADD COLUMN "invoiceSeq" INTEGER NOT NULL DEFAULT 0;

UPDATE "Company" c
SET "invoiceSeq" = GREATEST(
  (SELECT count(*) FROM "Invoice" i WHERE i."companyId" = c.id),
  COALESCE((
    SELECT max(substring(i."invoiceNumber" FROM '^INV-([0-9]+)$')::int)
    FROM "Invoice" i
    WHERE i."companyId" = c.id AND i."invoiceNumber" ~ '^INV-[0-9]+$'
  ), 0)
);
