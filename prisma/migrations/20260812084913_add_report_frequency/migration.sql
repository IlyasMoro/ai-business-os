-- CreateEnum
CREATE TYPE "ReportFrequency" AS ENUM ('OFF', 'WEEKLY', 'MONTHLY', 'QUARTERLY');

-- AlterTable
ALTER TABLE "AutomationSettings" ADD COLUMN     "lastReportSentAt" TIMESTAMP(3),
ADD COLUMN     "reportFrequency" "ReportFrequency" NOT NULL DEFAULT 'OFF';
