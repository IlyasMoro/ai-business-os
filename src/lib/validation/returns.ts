import * as z from "zod";
import { lineQuantity } from "@/lib/validation/quantity";
import { ReturnConditionValues } from "@/lib/returns-math";

export const ReturnSchema = z.object({
  orderId: z.string().min(1, { error: "Select an order." }),
  reason: z.string().trim().min(1, { error: "Choose a reason." }).max(200),
  notes: z.string().trim().max(2000).optional(),
});

export const ReturnItemSchema = z.object({
  orderItemId: z.string().min(1, { error: "Select an item." }),
  quantity: lineQuantity(),
  condition: z.enum(ReturnConditionValues),
});

export const ReturnPolicySchema = z.object({
  enabled: z.boolean(),
  windowDays: z.coerce.number().int().min(0).max(3650),
  requireApproval: z.boolean(),
  restockingFeePercent: z.coerce.number().min(0).max(100),
  restockDamaged: z.boolean(),
  reasons: z.string().trim().max(2000),
});
