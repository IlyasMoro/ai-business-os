/* The public web lead form: what it accepts and the spam checks. No
   database access here; the route and action live in app/f. */

import * as z from "zod";

export const LeadFormSchema = z.object({
  name: z.string().trim().min(2, { error: "Please enter your name." }).max(120),
  email: z.email({ error: "Please enter a valid email address." }).trim().max(200),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(120).optional(),
  message: z.string().trim().max(3000).optional(),
});

export type LeadFormInput = z.infer<typeof LeadFormSchema>;

/** The hidden field real people never fill in. */
export const HONEYPOT_FIELD = "website";

/** Bots post the instant the page loads; people take a few seconds. */
export const MIN_FILL_MS = 2500;
/** A form left open this long is treated as stale (asks to reload). */
export const MAX_FILL_MS = 24 * 60 * 60 * 1000;

/** Why a submission looks automated, or null when it looks like a person. */
export function spamReason(input: { honeypot: string | null; startedAt: number; now: number }): "honeypot" | "too-fast" | "stale" | null {
  if (input.honeypot && input.honeypot.trim() !== "") return "honeypot";
  if (!Number.isFinite(input.startedAt)) return "too-fast";
  const elapsed = input.now - input.startedAt;
  if (elapsed < MIN_FILL_MS) return "too-fast";
  if (elapsed > MAX_FILL_MS) return "stale";
  return null;
}

export const FORM_DEFAULTS = {
  title: "Get in touch",
  intro: "Tell us a little about what you need and we'll get back to you within one working day.",
  thanks: "Thank you. We have your message and will be in touch soon.",
};
