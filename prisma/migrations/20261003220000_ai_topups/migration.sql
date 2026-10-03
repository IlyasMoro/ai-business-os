-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "aiCredits" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AiTopUp" (
    "id" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "requests" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "AiTopUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiTopUp_stripeSessionId_key" ON "AiTopUp"("stripeSessionId");

-- CreateIndex
CREATE INDEX "AiTopUp_companyId_createdAt_idx" ON "AiTopUp"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiTopUp" ADD CONSTRAINT "AiTopUp_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

