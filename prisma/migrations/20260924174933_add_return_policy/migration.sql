-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "fulfilledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReturnPolicy" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "windowDays" INTEGER NOT NULL DEFAULT 30,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "restockingFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "restockDamaged" BOOLEAN NOT NULL DEFAULT false,
    "reasons" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "ReturnPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReturnPolicy_companyId_key" ON "ReturnPolicy"("companyId");

-- AddForeignKey
ALTER TABLE "ReturnPolicy" ADD CONSTRAINT "ReturnPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
