-- CreateEnum
CREATE TYPE "CrmRuleTrigger" AS ENUM ('DEAL_WON', 'DEAL_LOST', 'DEAL_STAGE', 'QUOTE_ACCEPTED', 'QUOTE_DECLINED', 'NEW_LEAD', 'CUSTOMER_QUIET');

-- CreateEnum
CREATE TYPE "CrmRuleAction" AS ENUM ('CREATE_REMINDER', 'ADD_TAG', 'ADD_TO_SEQUENCE', 'SET_STATUS', 'EMAIL_PERSON');

-- AlterEnum
ALTER TYPE "CrmActivityType" ADD VALUE 'WHATSAPP';

-- AlterTable
ALTER TABLE "CrmSettings" ADD COLUMN     "whatsappCountryCode" TEXT NOT NULL DEFAULT '27';

-- CreateTable
CREATE TABLE "DealItem" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "dealId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "DealItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "trigger" "CrmRuleTrigger" NOT NULL,
    "stage" "DealStage",
    "quietDays" INTEGER,
    "action" "CrmRuleAction" NOT NULL,
    "title" TEXT,
    "dueInDays" INTEGER,
    "assigneeId" TEXT,
    "tagId" TEXT,
    "sequenceId" TEXT,
    "status" "CustomerStatus",
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "CrmRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmRuleRun" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ruleId" TEXT NOT NULL,

    CONSTRAINT "CrmRuleRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealItem_dealId_idx" ON "DealItem"("dealId");

-- CreateIndex
CREATE INDEX "CrmRule_companyId_trigger_idx" ON "CrmRule"("companyId", "trigger");

-- CreateIndex
CREATE UNIQUE INDEX "CrmRuleRun_ruleId_key_key" ON "CrmRuleRun"("ruleId", "key");

-- AddForeignKey
ALTER TABLE "DealItem" ADD CONSTRAINT "DealItem_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealItem" ADD CONSTRAINT "DealItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmRule" ADD CONSTRAINT "CrmRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmRuleRun" ADD CONSTRAINT "CrmRuleRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "CrmRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

