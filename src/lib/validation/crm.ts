import * as z from "zod";

export const CustomerSchema = z.object({
  name: z.string().min(1, { error: "Name is required." }).trim(),
  email: z.union([z.email({ error: "Enter a valid email." }), z.literal("")]).optional(),
  phone: z.string().trim().optional(),
  company: z.string().trim().optional(),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]),
  notes: z.string().trim().optional(),
  campaignId: z.string().trim().optional(),
  creditLimit: z.union([
    z.coerce.number({ error: "Enter a valid credit limit." }).min(0, { error: "Credit limit cannot be negative." }),
    z.literal(""),
  ]).optional(),
});

export const ContactSchema = z.object({
  name: z.string().min(1, { error: "Name is required." }).trim(),
  email: z.union([z.email({ error: "Enter a valid email." }), z.literal("")]).optional(),
  phone: z.string().trim().optional(),
  role: z.string().trim().optional(),
});
