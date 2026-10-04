-- AlterTable
ALTER TABLE "AutomationSettings" ADD COLUMN     "draftInvoiceOnFulfil" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lateOrderAlertSentAt" TIMESTAMP(3),
ADD COLUMN     "lateOrderAlerts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lotExpiryAlertSentAt" TIMESTAMP(3),
ADD COLUMN     "lotExpiryAlerts" BOOLEAN NOT NULL DEFAULT false;

