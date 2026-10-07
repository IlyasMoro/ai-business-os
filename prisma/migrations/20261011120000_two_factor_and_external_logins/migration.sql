-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twoFactorEnabledAt" TIMESTAMP(3),
ADD COLUMN     "twoFactorLastStep" INTEGER,
ADD COLUMN     "twoFactorPendingSecret" TEXT,
ADD COLUMN     "twoFactorRecoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "twoFactorSecret" TEXT;

-- CreateTable
CREATE TABLE "ExternalLogin" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ExternalLogin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalLogin_userId_idx" ON "ExternalLogin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalLogin_provider_subject_key" ON "ExternalLogin"("provider", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalLogin_userId_provider_key" ON "ExternalLogin"("userId", "provider");

-- AddForeignKey
ALTER TABLE "ExternalLogin" ADD CONSTRAINT "ExternalLogin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

