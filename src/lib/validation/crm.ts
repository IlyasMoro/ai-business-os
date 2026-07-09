import * as z from "zod";

export const CustomerSchema = z.object({
  name: z.string().min(1, { error: "Name is required." }).trim(),
  email: z.union([z.email({ error: "Enter a valid email." }), z.literal("")]).optional(),
  phone: z.string().trim().optional(),
  company: z.string().trim().optional(),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]),
  notes: z.string().trim().optional(),
});

export const ContactSchema = z.object({
  name: z.string().min(1, { error: "Name is required." }).trim(),
  email: z.union([z.email({ error: "Enter a valid email." }), z.literal("")]).optional(),
  phone: z.string().trim().optional(),
  role: z.string().trim().optional(),
});
