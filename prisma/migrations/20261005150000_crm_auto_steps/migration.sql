-- AlterTable
ALTER TABLE "CrmSettings" ADD COLUMN     "autoDealOverdue" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoQuoteExpiry" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoQuoteOpened" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dailyDigest" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "closeNudgedFor" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "expiryNudgedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "digestSentOn" TEXT;

