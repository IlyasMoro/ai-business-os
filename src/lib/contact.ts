import * as z from "zod";

/* The public contact form: topics and validation. Shared by the page, the
   action and tests. */

export const CONTACT_TOPICS = [
  { id: "SALES", label: "Choosing a plan" },
  { id: "ENTERPRISE", label: "Enterprise plan" },
  { id: "SUPPORT", label: "Help with my account" },
  { id: "OTHER", label: "Something else" },
] as const;

export type ContactTopicId = (typeof CONTACT_TOPICS)[number]["id"];

export function topicLabel(id: string): string {
  return CONTACT_TOPICS.find((t) => t.id === id)?.label ?? "Something else";
}

/** ?topic=enterprise (from a "Talk to us" link) picks the topic up front. */
export function topicFromQuery(raw: string | undefined): ContactTopicId {
  const up = (raw ?? "").toUpperCase();
  return CONTACT_TOPICS.some((t) => t.id === up) ? (up as ContactTopicId) : "SALES";
}

/** "60 people, 4 branches" for the inbox and the email; empty if neither was given. */
export function sizeLine(teamSize: number | null | undefined, branches: number | null | undefined): string {
  const parts = [];
  if (teamSize) parts.push(`${teamSize.toLocaleString("en-US")} ${teamSize === 1 ? "person" : "people"}`);
  if (branches) parts.push(`${branches.toLocaleString("en-US")} ${branches === 1 ? "branch" : "branches"}`);
  return parts.join(", ");
}

export const ContactSchema = z.object({
  name: z.string().trim().min(2, { error: "Tell us your name." }).max(100),
  email: z.email({ error: "Enter a valid email address so we can reply." }).max(200),
  company: z.string().trim().max(150).optional(),
  topic: z.enum(CONTACT_TOPICS.map((t) => t.id) as [ContactTopicId, ...ContactTopicId[]]),
  message: z.string().trim().min(10, { error: "Write a little more so we can help." }).max(4000),
  // Asked only when the topic is Enterprise; both optional.
  teamSize: z.coerce.number({ error: "Enter a number of people." }).int().min(1, { error: "At least 1 person." }).max(100000).optional(),
  branches: z.coerce.number({ error: "Enter a number of branches." }).int().min(1, { error: "At least 1 branch." }).max(10000).optional(),
});

export type ContactFormState = { ok?: true; errors?: Record<string, string[]>; message?: string } | undefined;
