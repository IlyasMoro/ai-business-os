import * as z from "zod";

export const ChatMessageSchema = z.object({
  content: z.string().min(1, { error: "Enter a message." }).trim(),
});

export type ChatMessageFormState =
  | {
      errors?: {
        content?: string[];
      };
      message?: string;
    }
  | undefined;
