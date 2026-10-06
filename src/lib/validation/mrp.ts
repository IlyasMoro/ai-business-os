import * as z from "zod";
import { lineQuantity } from "@/lib/validation/quantity";

export const BomLineSchema = z.object({
  componentId: z.string().min(1, { error: "Select a component." }),
  quantity: z.coerce
    .number({ error: "Enter a valid quantity." })
    .positive({ error: "Quantity must be more than 0." })
    .max(1_000_000),
});

export const PlanningFieldsSchema = z.object({
  leadTimeDays: z.coerce.number().int().min(0).max(3650),
  lotSize: lineQuantity(),
  preferredSupplierId: z.string().optional(),
});

export const WorkOrderSchema = z.object({
  productId: z.string().min(1, { error: "Select a product." }),
  quantity: lineQuantity(),
  dueDate: z.union([z.iso.date(), z.literal("")]).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const MrpSettingsSchema = z.object({
  enabled: z.boolean(),
  includePendingOrders: z.boolean(),
  useSafetyStock: z.boolean(),
  allowNegativeStock: z.boolean(),
});
