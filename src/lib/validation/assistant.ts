import * as z from "zod";

export const ChatMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, { error: "Enter a message." })
    .max(4000, { error: "Keep messages under 4,000 characters." }),
});

export type ChatMessageFormState =
  | {
      errors?: {
        content?: string[];
      };
      message?: string;
    }
  | undefined;
