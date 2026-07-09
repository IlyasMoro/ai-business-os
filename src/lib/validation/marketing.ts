import * as z from "zod";

export const CampaignChannelValues = ["EMAIL", "SOCIAL", "ADS", "EVENT", "REFERRAL", "OTHER"] as const;
export const CampaignStatusValues = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"] as const;

export const CampaignSchema = z.object({
  name: z.string().min(1, { error: "Name is required." }).trim(),
  channel: z.enum(CampaignChannelValues),
  budget: z.coerce.number({ error: "Enter a valid budget." }).min(0, { error: "Budget can't be negative." }),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
