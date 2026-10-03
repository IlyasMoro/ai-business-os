-- CreateEnum
CREATE TYPE "CompanyPlan" AS ENUM ('STARTER', 'GROWTH', 'SCALE');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "plan" "CompanyPlan" NOT NULL DEFAULT 'SCALE';

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiUsage_companyId_month_key" ON "AiUsage"("companyId", "month");

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

