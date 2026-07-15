import * as z from "zod";

export const TicketStatusValues = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export const TicketPriorityValues = ["LOW", "MEDIUM", "HIGH"] as const;

export const TicketSchema = z.object({
  customerId: z.string().min(1, { error: "Select a customer." }),
  subject: z.string().min(1, { error: "Subject is required." }).trim(),
  description: z.string().trim().optional(),
  priority: z.enum(TicketPriorityValues, { error: "Select a priority." }),
  assigneeId: z.string().trim().optional(),
});

export type TicketFormState =
  | {
      errors?: {
        customerId?: string[];
        subject?: string[];
        description?: string[];
        priority?: string[];
        assigneeId?: string[];
      };
      message?: string;
    }
  | undefined;

export const TicketMessageSchema = z.object({
  content: z.string().min(1, { error: "Message can't be empty." }).trim(),
});

export type TicketMessageFormState =
  | {
      errors?: { content?: string[] };
      message?: string;
    }
  | undefined;
