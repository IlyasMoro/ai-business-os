-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'OTHER');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "creditNoteSeq" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "amountCredited" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'OTHER',
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "transactionId" TEXT,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "creditNumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoicePayment_transactionId_key" ON "InvoicePayment"("transactionId");

-- CreateIndex
CREATE INDEX "InvoicePayment_invoiceId_idx" ON "InvoicePayment"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoicePayment_companyId_idx" ON "InvoicePayment"("companyId");

-- CreateIndex
CREATE INDEX "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_companyId_creditNumber_key" ON "CreditNote"("companyId", "creditNumber");

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Existing paid invoices: each income transaction their "mark paid" booked
-- becomes a payment record, dated when it was booked, so nothing in
-- Accounting changes.
INSERT INTO "InvoicePayment" ("id", "amount", "paidAt", "method", "createdAt", "invoiceId", "companyId", "transactionId")
SELECT 'pay_' || replace(gen_random_uuid()::text, '-', ''), t."amount", t."date", 'OTHER', t."date", t."invoiceId", t."companyId", t."id"
FROM "Transaction" t
WHERE t."invoiceId" IS NOT NULL AND t."type" = 'INCOME' AND t."category" = 'Invoice payment';

UPDATE "Invoice" i
SET "amountPaid" = COALESCE((SELECT sum(p."amount") FROM "InvoicePayment" p WHERE p."invoiceId" = i.id), 0);

-- A paid invoice with no booked income (marked paid before income was
-- booked) still counts as paid in full.
UPDATE "Invoice" SET "amountPaid" = "totalAmount" WHERE "status" = 'PAID' AND "amountPaid" = 0;
