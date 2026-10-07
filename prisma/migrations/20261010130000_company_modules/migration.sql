-- Modules a company switched off on Settings > Modules.
ALTER TABLE "Company" ADD COLUMN "disabledModules" TEXT[] DEFAULT ARRAY[]::TEXT[];
