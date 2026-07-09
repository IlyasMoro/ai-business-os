import * as z from "zod";

export const CalendarEventTypeValues = ["MEETING", "REMINDER", "OTHER"] as const;

export const CalendarEventSchema = z.object({
  title: z.string().min(1, { error: "Title is required." }).trim(),
  type: z.enum(CalendarEventTypeValues),
  startAt: z.string().min(1, { error: "Select a date and time." }),
  endAt: z.string().trim().optional(),
  description: z.string().trim().optional(),
});
