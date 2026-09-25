-- CreateEnum
CREATE TYPE "InternalOrderStatus" AS ENUM ('OPEN', 'CLOSED', 'SETTLED');

-- CreateEnum
CREATE TYPE "CoPostingKind" AS ENUM ('ALLOCATION', 'SETTLEMENT');

-- CreateEnum
CREATE TYPE "OverBudgetAction" AS ENUM ('NONE', 'WARN', 'BLOCK');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "costCenterId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "costCenterId" TEXT,
ADD COLUMN     "internalOrderId" TEXT;

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostBudget" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "costCenterId" TEXT NOT NULL,

    CONSTRAINT "CostBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "InternalOrderStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "settleToId" TEXT,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "InternalOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoAllocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "senderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "CoAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoAllocationReceiver" (
    "id" TEXT NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL,
    "allocationId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,

    CONSTRAINT "CoAllocationReceiver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoAllocationRun" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allocationId" TEXT NOT NULL,

    CONSTRAINT "CoAllocationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoPosting" (
    "id" TEXT NOT NULL,
    "kind" "CoPostingKind" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "costCenterId" TEXT,
    "internalOrderId" TEXT,
    "runId" TEXT,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "CoPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControllingSettings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "overBudgetAction" "OverBudgetAction" NOT NULL DEFAULT 'WARN',
    "tolerancePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "includePayroll" BOOLEAN NOT NULL DEFAULT true,
    "requireCostCenter" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "ControllingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostCenter_companyId_idx" ON "CostCenter"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_companyId_code_key" ON "CostCenter"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CostBudget_costCenterId_year_month_key" ON "CostBudget"("costCenterId", "year", "month");

-- CreateIndex
CREATE INDEX "InternalOrder_companyId_idx" ON "InternalOrder"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InternalOrder_companyId_orderNumber_key" ON "InternalOrder"("companyId", "orderNumber");

-- CreateIndex
CREATE INDEX "CoAllocation_companyId_idx" ON "CoAllocation"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CoAllocationReceiver_allocationId_costCenterId_key" ON "CoAllocationReceiver"("allocationId", "costCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "CoAllocationRun_allocationId_year_month_key" ON "CoAllocationRun"("allocationId", "year", "month");

-- CreateIndex
CREATE INDEX "CoPosting_companyId_idx" ON "CoPosting"("companyId");

-- CreateIndex
CREATE INDEX "CoPosting_costCenterId_idx" ON "CoPosting"("costCenterId");

-- CreateIndex
CREATE INDEX "CoPosting_internalOrderId_idx" ON "CoPosting"("internalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ControllingSettings_companyId_key" ON "ControllingSettings"("companyId");

-- CreateIndex
CREATE INDEX "Transaction_costCenterId_idx" ON "Transaction"("costCenterId");

-- CreateIndex
CREATE INDEX "Transaction_internalOrderId_idx" ON "Transaction"("internalOrderId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_internalOrderId_fkey" FOREIGN KEY ("internalOrderId") REFERENCES "InternalOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostBudget" ADD CONSTRAINT "CostBudget_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalOrder" ADD CONSTRAINT "InternalOrder_settleToId_fkey" FOREIGN KEY ("settleToId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalOrder" ADD CONSTRAINT "InternalOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoAllocation" ADD CONSTRAINT "CoAllocation_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "CostCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoAllocation" ADD CONSTRAINT "CoAllocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoAllocationReceiver" ADD CONSTRAINT "CoAllocationReceiver_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "CoAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoAllocationReceiver" ADD CONSTRAINT "CoAllocationReceiver_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoAllocationRun" ADD CONSTRAINT "CoAllocationRun_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "CoAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoPosting" ADD CONSTRAINT "CoPosting_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoPosting" ADD CONSTRAINT "CoPosting_internalOrderId_fkey" FOREIGN KEY ("internalOrderId") REFERENCES "InternalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoPosting" ADD CONSTRAINT "CoPosting_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CoAllocationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoPosting" ADD CONSTRAINT "CoPosting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControllingSettings" ADD CONSTRAINT "ControllingSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
