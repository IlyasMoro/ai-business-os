-- AlterTable
ALTER TABLE "AutomationSettings" ADD COLUMN     "creditLimitWarnings" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "creditWarningSentAt" TIMESTAMP(3);
