-- AlterTable
ALTER TABLE "TeamInvite" ADD COLUMN     "companyRoleId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "companyRoleId" TEXT;

-- CreateTable
CREATE TABLE "CompanyRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseRole" "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
    "access" JSONB NOT NULL DEFAULT '{}',
    "preset" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "CompanyRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyRole_companyId_idx" ON "CompanyRole"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyRole_companyId_name_key" ON "CompanyRole"("companyId", "name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyRoleId_fkey" FOREIGN KEY ("companyRoleId") REFERENCES "CompanyRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_companyRoleId_fkey" FOREIGN KEY ("companyRoleId") REFERENCES "CompanyRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRole" ADD CONSTRAINT "CompanyRole_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

