import * as z from "zod";

export const CampaignChannelValues = ["EMAIL", "SOCIAL", "ADS", "EVENT", "REFERRAL", "OTHER"] as const;
export const CampaignStatusValues = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"] as const;

export const CampaignSchema = z
  .object({
    name: z.string().trim().min(1, { error: "Name is required." }).max(200),
    channel: z.enum(CampaignChannelValues),
    budget: z.coerce.number({ error: "Enter a valid budget." }).min(0, { error: "Budget can't be negative." }).max(1e9),
    // Blank means nothing spent yet.
    spent: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? 0 : v),
      z.coerce.number({ error: "Enter a valid amount spent." }).min(0, { error: "Amount spent can't be negative." }).max(1e9)
    ),
    startDate: z.string().trim().optional(),
    endDate: z.string().trim().optional(),
    notes: z.string().trim().max(5000).optional(),
  })
  .refine((c) => !c.startDate || !c.endDate || c.endDate >= c.startDate, {
    error: "The end date can't be before the start date.",
    path: ["endDate"],
  });
