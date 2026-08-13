import * as z from "zod";

export const WebhookUrlSchema = z.object({
  webhookUrl: z.union([z.url({ error: "Enter a valid URL." }), z.literal("")]),
});
