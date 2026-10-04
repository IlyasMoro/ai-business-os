/* Reading email headers for the mailbox sync: who an email was from and to,
   and which customers it belongs to. No database or network access here. */

/** Every address in a header like `"Smith, Ann" <ann@x.com>, bob@y.com`, lowercased. */
export function parseAddresses(header: string | null | undefined): string[] {
  if (!header) return [];
  const found = header.match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
  return [...new Set(found.map((a) => a.toLowerCase()))];
}

export type MailHeaders = { from: string | null; to: string | null; cc: string | null; subject: string | null };

export type MailMatch = {
  direction: "in" | "out";
  /** Customer ids the email belongs to. */
  customerIds: string[];
};

/**
 * Works out whether an email was sent from the mailbox ("out") or to it
 * ("in"), and which customers it involves: the sender for incoming mail,
 * the recipients for outgoing mail. `byEmail` maps a customer's or contact's
 * email to the customer id. Mail between two of your own addresses, or with
 * no customer in it, matches nobody.
 */
export function matchEmail(headers: MailHeaders, mailbox: string, byEmail: Map<string, string>): MailMatch {
  const from = parseAddresses(headers.from);
  const outgoing = from.includes(mailbox.toLowerCase());
  const people = outgoing ? [...parseAddresses(headers.to), ...parseAddresses(headers.cc)] : from;
  const customerIds = [...new Set(people.map((a) => byEmail.get(a)).filter((id): id is string => Boolean(id)))];
  return { direction: outgoing ? "out" : "in", customerIds };
}

/** The activity text for a logged email, kept short. */
export function emailActivityBody(direction: "in" | "out", subject: string | null, snippet: string | null): string {
  const title = subject?.trim() || "(no subject)";
  const preview = snippet?.replace(/\s+/g, " ").trim();
  const lead = direction === "in" ? "Email received" : "Email sent";
  const body = `${lead}: ${title}${preview ? `\n${preview}` : ""}`;
  return body.length > 1000 ? `${body.slice(0, 997)}...` : body;
}
