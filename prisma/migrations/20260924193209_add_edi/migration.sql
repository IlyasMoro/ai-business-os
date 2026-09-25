-- CreateEnum
CREATE TYPE "EdiDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "EdiStatus" AS ENUM ('GENERATED', 'PROCESSED', 'REJECTED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerPoNumber" TEXT;

-- CreateTable
CREATE TABLE "EdiSettings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isaQualifier" TEXT NOT NULL DEFAULT 'ZZ',
    "isaId" TEXT NOT NULL,
    "gsId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '004010',
    "usageIndicator" TEXT NOT NULL DEFAULT 'T',
    "elementSeparator" TEXT NOT NULL DEFAULT '*',
    "subElementSeparator" TEXT NOT NULL DEFAULT '>',
    "segmentTerminator" TEXT NOT NULL DEFAULT '~',
    "nextControlNumber" INTEGER NOT NULL DEFAULT 1,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "EdiSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EdiPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isaQualifier" TEXT NOT NULL DEFAULT 'ZZ',
    "isaId" TEXT NOT NULL,
    "gsId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "receive850" BOOLEAN NOT NULL DEFAULT true,
    "send810" BOOLEAN NOT NULL DEFAULT true,
    "send856" BOOLEAN NOT NULL DEFAULT true,
    "send850" BOOLEAN NOT NULL DEFAULT true,
    "useEdiPrices" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT,
    "supplierId" TEXT,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "EdiPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EdiDocument" (
    "id" TEXT NOT NULL,
    "direction" "EdiDirection" NOT NULL,
    "docType" TEXT NOT NULL,
    "status" "EdiStatus" NOT NULL,
    "controlNumber" INTEGER NOT NULL,
    "reference" TEXT,
    "error" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partnerId" TEXT,
    "orderId" TEXT,
    "purchaseOrderId" TEXT,
    "invoiceId" TEXT,
    "acknowledgesId" TEXT,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "EdiDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EdiSettings_companyId_key" ON "EdiSettings"("companyId");

-- CreateIndex
CREATE INDEX "EdiPartner_companyId_idx" ON "EdiPartner"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "EdiPartner_companyId_isaQualifier_isaId_key" ON "EdiPartner"("companyId", "isaQualifier", "isaId");

-- CreateIndex
CREATE INDEX "EdiDocument_companyId_idx" ON "EdiDocument"("companyId");

-- CreateIndex
CREATE INDEX "EdiDocument_partnerId_idx" ON "EdiDocument"("partnerId");

-- CreateIndex
CREATE INDEX "EdiDocument_orderId_idx" ON "EdiDocument"("orderId");

-- AddForeignKey
ALTER TABLE "EdiSettings" ADD CONSTRAINT "EdiSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdiPartner" ADD CONSTRAINT "EdiPartner_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdiPartner" ADD CONSTRAINT "EdiPartner_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdiPartner" ADD CONSTRAINT "EdiPartner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdiDocument" ADD CONSTRAINT "EdiDocument_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "EdiPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdiDocument" ADD CONSTRAINT "EdiDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
