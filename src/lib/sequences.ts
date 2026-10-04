/* Email sequences: filling in the placeholders, turning the plain text the
   user writes into email HTML, and when each email is due. No database
   access here; lib/sequence-runner.ts sends them. */

export const MAX_STEPS = 10;
export const MAX_DELAY_DAYS = 90;

export const PLACEHOLDERS = [
  { tag: "{{first_name}}", label: "First name" },
  { tag: "{{name}}", label: "Full name" },
  { tag: "{{company}}", label: "Their company" },
  { tag: "{{sender_name}}", label: "Your name" },
  { tag: "{{my_company}}", label: "Your company" },
] as const;

export type TemplateVars = {
  name: string;
  company: string | null;
  senderName: string;
  myCompany: string;
};

/** Fills the placeholders. A missing company reads as "your company" so a
 * sentence never ends up with a gap. Unknown placeholders are removed. */
export function renderTemplate(text: string, vars: TemplateVars): string {
  const first = vars.name.trim().split(/\s+/)[0] || vars.name;
  const values: Record<string, string> = {
    first_name: first,
    name: vars.name,
    company: vars.company?.trim() || "your company",
    sender_name: vars.senderName,
    my_company: vars.myCompany,
  };
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => values[key.toLowerCase()] ?? "");
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Plain text to simple email HTML: blank lines make paragraphs, single
 * line breaks stay, and an unsubscribe line goes at the bottom. */
export function bodyToHtml(body: string, unsubscribeUrl: string | null): string {
  const paragraphs = body
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const footer = unsubscribeUrl
    ? `<p style="margin-top:24px;font-size:12px;color:#8a93a3">Don't want these emails? <a href="${escapeHtml(unsubscribeUrl)}" style="color:#8a93a3">Unsubscribe</a>.</p>`
    : "";
  return paragraphs + footer;
}

/** When a step is due: its delay in days after `from` (enrolling or the
 * previous email). */
export function dueAfter(from: Date, delayDays: number): Date {
  return new Date(from.getTime() + Math.max(0, delayDays) * 24 * 60 * 60 * 1000);
}

/** "Day 0, day 3, day 7": when each step goes out, counted from enrolling. */
export function stepDays(delays: number[]): number[] {
  let total = 0;
  return delays.map((d) => (total += Math.max(0, d)));
}

export const ENROLLMENT_LABELS = {
  ACTIVE: { label: "Active", tone: "blue" },
  COMPLETED: { label: "Finished", tone: "green" },
  REPLIED: { label: "Replied", tone: "purple" },
  STOPPED: { label: "Stopped", tone: "slate" },
} as const;
