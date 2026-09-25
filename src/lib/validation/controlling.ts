import * as z from "zod";

export const CostCenterSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,10}$/, { error: "Use up to 10 letters or digits, like 1000 or SALES." }),
  name: z.string().trim().min(1, { error: "Name is required." }).max(100),
  description: z.string().trim().max(500).optional(),
});

export const CostCenterUpdateSchema = CostCenterSchema.omit({ code: true }).extend({ active: z.boolean() });

const money = z.coerce.number({ error: "Enter a valid amount." }).min(0, { error: "Amounts can't be negative." }).max(1e12);

export const InternalOrderSchema = z.object({
  name: z.string().trim().min(1, { error: "Name is required." }).max(100),
  description: z.string().trim().max(500).optional(),
  budget: money,
  settleToId: z.string().optional(),
});

export const AllocationSchema = z.object({
  name: z.string().trim().min(1, { error: "Name is required." }).max(100),
  senderId: z.string().min(1, { error: "Choose the cost center to allocate from." }),
  receivers: z
    .array(z.object({ costCenterId: z.string().min(1), percent: z.coerce.number() }))
    .min(1, { error: "Add at least one receiver." }),
});

export const PeriodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const ControllingSettingsSchema = z.object({
  enabled: z.boolean(),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
  overBudgetAction: z.enum(["NONE", "WARN", "BLOCK"]),
  tolerancePercent: z.coerce.number().min(0).max(100),
  includePayroll: z.boolean(),
  requireCostCenter: z.boolean(),
});

export { money as MoneySchema };
