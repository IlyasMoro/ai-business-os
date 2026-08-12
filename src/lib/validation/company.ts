import * as z from "zod";

export const CompanyProfileSchema = z.object({
  name: z.string().trim().min(1, { error: "Company name is required." }).max(200),
  industry: z.string().trim().max(200).optional(),
});
