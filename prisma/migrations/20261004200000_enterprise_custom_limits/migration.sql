-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "customAiRequests" INTEGER,
ADD COLUMN     "customBranches" INTEGER,
ADD COLUMN     "customEdi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "customUsers" INTEGER;

