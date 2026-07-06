import * as z from "zod";

export const InvoiceStatusValues = ["DRAFT", "SENT", "PAID", "OVERDUE"] as const;

export const InvoiceSchema = z.object({
  customerId: z.string().min(1, { error: "Select a customer." }),
  dueDate: z.string().min(1, { error: "Due date is required." }),
});

export type InvoiceFormState =
  | {
      errors?: {
        customerId?: string[];
        dueDate?: string[];
      };
      message?: string;
    }
  | undefined;

export const InvoiceLineItemSchema = z.object({
  description: z.string().min(1, { error: "Description is required." }).trim(),
  quantity: z.coerce
    .number({ error: "Enter a valid quantity." })
    .int({ error: "Quantity must be a whole number." })
    .min(1, { error: "Quantity must be at least 1." }),
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
