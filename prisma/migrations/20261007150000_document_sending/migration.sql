-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "confirmationSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "sentAt" TIMESTAMP(3);

