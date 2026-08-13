import * as z from "zod";

export const PlatformEmailSettingsSchema = z.object({
  resendApiKey: z.string().trim().optional(),
  resendFromEmail: z.union([z.email({ error: "Enter a valid email." }), z.literal("")]).optional(),
});

export const PlatformGroqSettingsSchema = z.object({
  groqApiKey: z.string().trim().optional(),
});

export const PlatformOpenAiSettingsSchema = z.object({
  openaiApiKey: z.string().trim().optional(),
});
