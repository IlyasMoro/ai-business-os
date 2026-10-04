import "server-only";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/plan-limits";
import { canReadMail, googleAccessToken } from "@/lib/google-token";
import { emailActivityBody, matchEmail, type MailHeaders } from "@/lib/mail-parse";
import { touchLeadScore } from "@/lib/lead-score-data";

/* Logs emails to and from customers, found in the company's connected
   Gmail, on each customer's activity history. Only the headers and Gmail's
   short preview are read and kept, never the full message. Runs from the
   cron and from "Sync now" in the CRM settings. */

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
/** How far back the first sync looks. */
const FIRST_SYNC_DAYS = 30;
/** Messages read per run; the rest are picked up next time. */
const PER_RUN = 300;

type GmailMessage = {
  id: string;
  internalDate: string;
  snippet?: string;
  payload?: { headers?: { name: string; value: string }[] };
};

async function gmail<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Gmail request failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as T;
}

export type SyncResult = { ok: true; scanned: number; logged: number } | { ok: false; reason: "not-connected" | "no-permission" | "plan" | "error" };

export async function syncMailbox(companyId: string): Promise<SyncResult> {
  if (!(await hasFeature(companyId, "integrations"))) return { ok: false, reason: "plan" };
  const integration = await db.googleIntegration.findUnique({ where: { companyId } });
  if (!integration) return { ok: false, reason: "not-connected" };
  if (!canReadMail(integration)) return { ok: false, reason: "no-permission" };

  try {
    const token = await googleAccessToken(integration);
    const since = integration.mailSyncedAt ?? new Date(Date.now() - FIRST_SYNC_DAYS * 24 * 60 * 60 * 1000);
    // Gmail's search works in whole seconds; a minute of overlap is safe
    // because each message is only ever logged once.
    const after = Math.floor(since.getTime() / 1000) - 60;

    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ q: `after:${after} -in:chats -in:spam -in:trash`, maxResults: "100" });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await gmail<{ messages?: { id: string }[]; nextPageToken?: string }>(token, `${GMAIL}?${params}`);
      ids.push(...(page.messages ?? []).map((m) => m.id));
      pageToken = page.nextPageToken;
    } while (pageToken && ids.length < 2000);

    // Gmail lists newest first; work oldest first so a partial run resumes cleanly.
    const batch = ids.reverse().slice(0, PER_RUN);

    const [customers, contacts, users] = await Promise.all([
      db.customer.findMany({ where: { companyId, email: { not: null } }, select: { id: true, email: true } }),
      db.contact.findMany({ where: { customer: { companyId }, email: { not: null } }, select: { customerId: true, email: true } }),
      db.user.findMany({ where: { companyId }, select: { email: true } }),
    ]);
    const own = new Set([integration.email.toLowerCase(), ...users.map((u) => u.email.toLowerCase())]);
    const byEmail = new Map<string, string>();
    for (const c of contacts) if (c.email && !own.has(c.email.toLowerCase())) byEmail.set(c.email.toLowerCase(), c.customerId);
    // A customer's own email wins over a contact with the same address.
    for (const c of customers) if (c.email && !own.has(c.email.toLowerCase())) byEmail.set(c.email.toLowerCase(), c.id);

    let logged = 0;
    let syncedTo = since;
    const touched = new Set<string>();
    const meta = ["From", "To", "Cc", "Subject"].map((h) => `metadataHeaders=${h}`).join("&");

    for (const id of batch) {
      const message = await gmail<GmailMessage>(token, `${GMAIL}/${id}?format=metadata&${meta}`);
      const at = new Date(Number(message.internalDate));
      if (at > syncedTo) syncedTo = at;
      if (byEmail.size === 0) continue;

      const header = (name: string) => message.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
      const headers: MailHeaders = { from: header("From"), to: header("To"), cc: header("Cc"), subject: header("Subject") };
      const match = matchEmail(headers, integration.email, byEmail);
      if (match.customerIds.length === 0) continue;

      const created = await db.crmActivity.createMany({
        data: match.customerIds.map((customerId) => ({
          type: "EMAIL" as const,
          body: emailActivityBody(match.direction, headers.subject, message.snippet ?? null),
          occurredAt: at,
          companyId,
          customerId,
          externalId: `gmail:${message.id}:${customerId}`,
        })),
        skipDuplicates: true,
      });
      logged += created.count;
      match.customerIds.forEach((c) => touched.add(c));

      // A reply ends the sequences they were in when they wrote.
      if (match.direction === "in" && created.count > 0) {
        await db.sequenceEnrollment.updateMany({
          where: { companyId, customerId: { in: match.customerIds }, status: "ACTIVE", createdAt: { lt: at } },
          data: { status: "REPLIED", endReason: "They replied", endedAt: new Date(), nextSendAt: null },
        });
      }
    }

    await db.googleIntegration.update({ where: { companyId }, data: { mailSyncedAt: batch.length < ids.length ? syncedTo : new Date() } });
    for (const customerId of touched) await touchLeadScore(companyId, customerId);
    return { ok: true, scanned: batch.length, logged };
  } catch (err) {
    console.error(`[mail-sync] failed for company ${companyId}:`, err);
    return { ok: false, reason: "error" };
  }
}

/** The cron's pass: every company that turned email logging on. */
export async function runMailSync() {
  const settings = await db.crmSettings.findMany({ where: { emailLogging: true }, select: { companyId: true } });
  let logged = 0;
  for (const { companyId } of settings) {
    const result = await syncMailbox(companyId);
    if (result.ok) logged += result.logged;
  }
  return { companies: settings.length, logged };
}
