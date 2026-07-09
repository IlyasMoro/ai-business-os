import * as z from "zod";

export const PurchaseOrderStatusValues = ["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"] as const;

export const SupplierSchema = z.object({
  name: z.string().min(1, { error: "Name is required." }).trim(),
  email: z.union([z.email({ error: "Enter a valid email." }), z.literal("")]).optional(),
  phone: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const PurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, { error: "Select a supplier." }),
});

export const PurchaseOrderItemSchema = z.object({
  productId: z.string().min(1, { error: "Select a product." }),
  quantity: z.coerce
    .number({ error: "Enter a valid quantity." })
    .int({ error: "Quantity must be a whole number." })
    .min(1, { error: "Quantity must be at least 1." }),
  unitCost: z.coerce
    .number({ error: "Enter a valid unit cost." })
    .min(0, { error: "Unit cost can't be negative." }),
});
