import * as z from "zod";
import { lineQuantity } from "@/lib/validation/quantity";

export const InvoiceStatusValues = ["DRAFT", "SENT", "PAID", "OVERDUE"] as const;

export const InvoiceSchema = z.object({
  customerId: z.string().min(1, { error: "Select a customer." }),
  dueDate: z.string().min(1, { error: "Due date is required." }),
  taxRate: z.coerce
    .number({ error: "Enter a valid tax rate." })
    .min(0, { error: "Tax rate cannot be negative." })
    .default(0),
});

export type InvoiceFormState =
  | {
      errors?: {
        customerId?: string[];
        dueDate?: string[];
        taxRate?: string[];
      };
      message?: string;
    }
  | undefined;

/** Editing an unpaid invoice's due date and tax rate. */
export const InvoiceDetailsSchema = z.object({
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Enter a valid date." }),
  taxRate: z.coerce.number({ error: "Enter a valid tax rate." }).min(0, { error: "Tax rate cannot be negative." }).max(100),
});

export const InvoiceLineItemSchema = z.object({
  description: z.string().min(1, { error: "Description is required." }).trim(),
  quantity: lineQuantity(),
  unitPrice: z.coerce
    .number({ error: "Enter a valid price." })
    .min(0, { error: "Price cannot be negative." }),
  productId: z.string().optional(),
});

export type InvoiceLineItemFormState =
  | {
      errors?: {
        description?: string[];
        quantity?: string[];
        unitPrice?: string[];
        productId?: string[];
      };
      message?: string;
    }
  | undefined;
