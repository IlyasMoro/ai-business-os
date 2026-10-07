-- Document numbers drop the hyphen, matching WO0001, RMA0001 and IO0001:
-- INV-0011 becomes INV0011. Only the exact app made pattern is renamed, so
-- numbers typed in by hand are left alone. Undo with the reverse
-- regexp_replace if ever needed.
UPDATE "Invoice" SET "invoiceNumber" = regexp_replace("invoiceNumber", '^INV-([0-9]+)$', 'INV\1') WHERE "invoiceNumber" ~ '^INV-[0-9]+$';
UPDATE "CreditNote" SET "creditNumber" = regexp_replace("creditNumber", '^CN-([0-9]+)$', 'CN\1') WHERE "creditNumber" ~ '^CN-[0-9]+$';
UPDATE "Order" SET "orderNumber" = regexp_replace("orderNumber", '^SO-([0-9]+)$', 'SO\1') WHERE "orderNumber" ~ '^SO-[0-9]+$';
UPDATE "PurchaseOrder" SET "poNumber" = regexp_replace("poNumber", '^PO-([0-9]+)$', 'PO\1') WHERE "poNumber" ~ '^PO-[0-9]+$';
UPDATE "Quote" SET "quoteNumber" = regexp_replace("quoteNumber", '^Q-([0-9]+)$', 'Q\1') WHERE "quoteNumber" ~ '^Q-[0-9]+$';
UPDATE "StockTransfer" SET "transferNumber" = regexp_replace("transferNumber", '^TR-([0-9]+)$', 'TR\1') WHERE "transferNumber" ~ '^TR-[0-9]+$';
