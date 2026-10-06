import * as z from "zod";
import { stockQuantity } from "@/lib/validation/quantity";

export const UnitValues = ["EACH", "KG", "L"] as const;

export const ProductSchema = z.object({
  sku: z.string().min(1, { error: "SKU is required." }).trim(),
  name: z.string().min(1, { error: "Name is required." }).trim(),
  description: z.string().trim().optional(),
  cost: z.coerce.number({ error: "Enter a valid cost." }).min(0, { error: "Cost cannot be negative." }),
  unitPrice: z.coerce
    .number({ error: "Enter a valid price." })
    .min(0, { error: "Price cannot be negative." }),
  // How the product is counted: by the piece, or by weight or volume.
  unit: z.enum(UnitValues).default("EACH"),
  stockQty: stockQuantity("Quantity"),
  reorderLevel: stockQuantity("Reorder level"),
});

/** Editing a product never touches stock: that goes through an adjustment,
 * which records why (lib/stock-history.ts). */
export const ProductEditSchema = ProductSchema.omit({ stockQty: true });

export type StockAdjustState = { ok?: true; message?: string } | undefined;

export type ProductFormState =
  | {
      errors?: {
        sku?: string[];
        name?: string[];
        description?: string[];
        cost?: string[];
        unitPrice?: string[];
        stockQty?: string[];
        reorderLevel?: string[];
        unit?: string[];
      };
      message?: string;
    }
  | undefined;
