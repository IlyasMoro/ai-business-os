import * as z from "zod";

export const EmployeeStatusValues = ["ACTIVE", "TERMINATED"] as const;

export const EmployeeSchema = z.object({
  name: z.string().min(1, { error: "Name is required." }).trim(),
  email: z.union([z.email({ error: "Enter a valid email." }), z.literal("")]).optional(),
  position: z.string().trim().optional(),
  department: z.string().trim().optional(),
  salary: z.coerce
    .number({ error: "Enter a valid salary." })
    .min(0, { error: "Salary cannot be negative." }),
  hireDate: z.string().min(1, { error: "Hire date is required." }),
  status: z.enum(EmployeeStatusValues, { error: "Select a status." }),
});

export type EmployeeFormState =
  | {
      errors?: {
        name?: string[];
        email?: string[];
        position?: string[];
        department?: string[];
        salary?: string[];
        hireDate?: string[];
        status?: string[];
      };
      message?: string;
    }
  | undefined;
