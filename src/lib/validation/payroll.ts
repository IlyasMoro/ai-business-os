import * as z from "zod";

export const PayrollRunStatusValues = ["DRAFT", "PROCESSED", "PAID"] as const;

export const PayrollRunSchema = z
  .object({
    periodStart: z.string().min(1, { error: "Period start is required." }),
    periodEnd: z.string().min(1, { error: "Period end is required." }),
  })
  .refine((data) => new Date(data.periodEnd) >= new Date(data.periodStart), {
    error: "Period end must be on or after period start.",
    path: ["periodEnd"],
  });

export type PayrollRunFormState =
  | {
      errors?: {
        periodStart?: string[];
        periodEnd?: string[];
      };
      message?: string;
    }
  | undefined;

export const PayrollItemSchema = z.object({
  employeeId: z.string().min(1, { error: "Select an employee." }),
  grossPay: z.coerce
    .number({ error: "Enter a valid gross pay." })
    .min(0, { error: "Gross pay cannot be negative." }),
  deductions: z.coerce
    .number({ error: "Enter a valid deduction amount." })
    .min(0, { error: "Deductions cannot be negative." }),
});

export type PayrollItemFormState =
  | {
      errors?: {
        employeeId?: string[];
        grossPay?: string[];
        deductions?: string[];
      };
      message?: string;
    }
  | undefined;
