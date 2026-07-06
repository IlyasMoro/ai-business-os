import * as z from "zod";

export const ProductSchema = z.object({
  sku: z.string().min(1, { error: "SKU is required." }).trim(),
  name: z.string().min(1, { error: "Name is required." }).trim(),
  description: z.string().trim().optional(),
  cost: z.coerce.number({ error: "Enter a valid cost." }).min(0, { error: "Cost cannot be negative." }),
  unitPrice: z.coerce
    .number({ error: "Enter a valid price." })
    .min(0, { error: "Price cannot be negative." }),
  stockQty: z.coerce
    .number({ error: "Enter a valid quantity." })
    .int({ error: "Quantity must be a whole number." })
    .min(0, { error: "Quantity cannot be negative." }),
  reorderLevel: z.coerce
    .number({ error: "Enter a valid reorder level." })
    .int({ error: "Reorder level must be a whole number." })
    .min(0, { error: "Reorder level cannot be negative." }),
});

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
      };
      message?: string;
    }
  | undefined;
