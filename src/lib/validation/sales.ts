import * as z from "zod";
import { lineQuantity } from "@/lib/validation/quantity";

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
  quantity: lineQuantity(),
});

/** Editing a pending order's line. Price is optional: only owners and
 * admins may change it (no unofficial discounts). */
export const OrderItemEditSchema = z.object({
  quantity: lineQuantity(),
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
