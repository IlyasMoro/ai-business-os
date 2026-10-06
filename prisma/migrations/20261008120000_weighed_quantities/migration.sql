-- Weighed products: a unit of measure on each product, and every quantity
-- column widened from INTEGER to DOUBLE PRECISION so stock and lines can
-- hold 1.350 kg. Existing whole numbers convert exactly; EACH products
-- are still kept to whole numbers by the application.

-- CreateEnum
CREATE TYPE "UnitOfMeasure" AS ENUM ('EACH', 'KG', 'L');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "unit" "UnitOfMeasure" NOT NULL DEFAULT 'EACH',
ALTER COLUMN "stockQty" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "reorderLevel" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "lotSize" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "BranchStock" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "reorderLevel" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "StockTransferItem" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PurchaseOrderItem" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "OrderItem" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "DealItem" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "QuoteItem" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ReturnItem" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "InvoiceLineItem" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "WorkOrder" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "StockLot" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "LotMovement" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "StockMovement" ALTER COLUMN "delta" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "quantityAfter" SET DATA TYPE DOUBLE PRECISION;
