import * as z from "zod";

export const TransactionTypeValues = ["INCOME", "EXPENSE"] as const;

export const TransactionSchema = z.object({
  type: z.enum(TransactionTypeValues, { error: "Select a type." }),
  category: z.string().min(1, { error: "Category is required." }).trim(),
  amount: z.coerce
    .number({ error: "Enter a valid amount." })
    .positive({ error: "Amount must be greater than zero." }),
  date: z.string().min(1, { error: "Date is required." }),
  description: z.string().trim().optional(),
});

export type TransactionFormState =
  | {
      errors?: {
        type?: string[];
        category?: string[];
        amount?: string[];
        date?: string[];
        description?: string[];
      };
      message?: string;
    }
  | undefined;
