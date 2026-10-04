import * as z from "zod";

export const OrderStatusValues = ["PENDING", "CONFIRMED", "FULFILLED", "CANCELLED"] as const;

export const OrderSchema = z.object({
  customerId: z.string().min(1, { error: "Select a customer." }),
});

export type OrderFormState =
  | {
      errors?: {
        customerId?: string[];
      };
      message?: string;
    }
  | undefined;

export const OrderItemSchema = z.object({
  productId: z.string().min(1, { error: "Select a product." }),
  quantity: z.coerce
    .number({ error: "Enter a valid quantity." })
    .int({ error: "Quantity must be a whole number." })
    .min(1, { error: "Quantity must be at least 1." }),
});

/** Editing a pending order's line. Price is optional: only owners and
 * admins may change it (no unofficial discounts). */
export const OrderItemEditSchema = z.object({
  quantity: z.coerce
    .number({ error: "Enter a valid quantity." })
    .int({ error: "Quantity must be a whole number." })
    .min(1, { error: "Quantity must be at least 1." }),
  unitPrice: z.coerce.number({ error: "Enter a valid price." }).min(0, { error: "Price cannot be negative." }).optional(),
});

export type OrderItemFormState =
  | {
      errors?: {
        productId?: string[];
        quantity?: string[];
      };
      message?: string;
    }
  | undefined;

export type OrderStatusFormState =
  | {
      message?: string;
    }
  | undefined;
