-- AlterTable
ALTER TABLE "AutomationSettings" ADD COLUMN     "webhookUrl" TEXT;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "logoData" BYTEA,
ADD COLUMN     "logoMimeType" TEXT;
