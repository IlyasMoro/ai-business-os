import "server-only";
import { db } from "@/lib/db";
import { sendEmailForCompany } from "@/lib/email-for-company";
import { isOpenStage } from "@/lib/crm-pipeline";

/* Built in automatic steps that need no setting up: a reminder to call when
   a customer opens a quote, a nudge before a quote expires and when a deal
   misses its close date, and a morning summary of each person's reminders.
   Each can be switched off in the CRM settings; a company that never saved
   the settings has them all on. Every step is made once (a stamp on the
   quote, deal or user) and never stops the person's own action. */

const DAY = 24 * 60 * 60 * 1000;
/** The morning summary goes out on the first cron run after this hour (UTC):
 * 05:00 UTC is 07:00 in South Africa. */
const DIGEST_HOUR_UTC = 5;
const QUOTE_EXPIRY_NOTICE_DAYS = 2;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const shortDay = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

type AutoKey = "autoQuoteOpened" | "autoQuoteExpiry" | "autoDealOverdue" | "dailyDigest";

/** Companies that switched this step off; everyone else has it on. */
async function switchedOff(key: AutoKey): Promise<Set<string>> {
  const rows = await db.crmSettings.findMany({ where: { [key]: false }, select: { companyId: true } });
  return new Set(rows.map((r) => r.companyId));
}

async function isOn(companyId: string, key: AutoKey) {
  const settings = await db.crmSettings.findUnique({
    where: { companyId },
    select: { autoQuoteOpened: true, autoQuoteExpiry: true, autoDealOverdue: true, dailyDigest: true },
  });
  return settings ? settings[key] : true;
}

/** Someone to give the reminder to: the quote or deal owner, else the customer's. */
const assignee = (own: string | null, customerOwner: string | null) => own ?? customerOwner ?? null;

/** The customer just opened their quote online: call while it's on their mind. */
export async function onQuoteOpened(quote: {
  id: string;
  quoteNumber: string;
  companyId: string;
  customerId: string;
  dealId: string | null;
  ownerId: string | null;
}) {
  try {
    if (!(await isOn(quote.companyId, "autoQuoteOpened"))) return;
    const customer = await db.customer.findUnique({ where: { id: quote.customerId }, select: { name: true, ownerId: true } });
    if (!customer) return;
    await db.followUp.create({
      data: {
        title: `Call ${customer.name}: they just opened quote ${quote.quoteNumber}`.slice(0, 200),
        dueAt: new Date(),
        companyId: quote.companyId,
        customerId: quote.customerId,
        dealId: quote.dealId,
        assigneeId: assignee(quote.ownerId, customer.ownerId),
      },
    });
  } catch (err) {
    console.error(`[crm-auto] quote opened step failed for ${quote.id}:`, err);
  }
}

/** Sent quotes running out within two days with no answer yet. */
async function quoteExpiryNudges(now: Date) {
  const off = await switchedOff("autoQuoteExpiry");
  const quotes = await db.quote.findMany({
    where: {
      status: "SENT",
      expiryNudgedAt: null,
      validUntil: { gte: new Date(now.getTime() - DAY), lte: new Date(now.getTime() + QUOTE_EXPIRY_NOTICE_DAYS * DAY) },
    },
    select: { id: true, quoteNumber: true, companyId: true, customerId: true, dealId: true, ownerId: true, validUntil: true, customer: { select: { name: true, ownerId: true } } },
    take: 500,
  });
  let made = 0;
  for (const q of quotes) {
    if (off.has(q.companyId)) continue;
    const claimed = await db.quote.updateMany({ where: { id: q.id, expiryNudgedAt: null }, data: { expiryNudgedAt: now } });
    if (claimed.count === 0) continue;
    await db.followUp.create({
      data: {
        title: `Quote ${q.quoteNumber} for ${q.customer.name} expires ${shortDay(q.validUntil!)}: follow up`.slice(0, 200),
        dueAt: now,
        companyId: q.companyId,
        customerId: q.customerId,
        dealId: q.dealId,
        assigneeId: assignee(q.ownerId, q.customer.ownerId),
      },
    });
    made += 1;
  }
  return made;
}

/** Open deals whose expected close date has passed: one reminder per missed date. */
async function overdueDealNudges(now: Date) {
  const off = await switchedOff("autoDealOverdue");
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const deals = await db.deal.findMany({
    where: { stage: { in: ["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION"] }, expectedClose: { lt: startOfToday } },
    select: { id: true, title: true, stage: true, companyId: true, customerId: true, ownerId: true, expectedClose: true, closeNudgedFor: true, customer: { select: { ownerId: true } } },
    take: 1000,
  });
  let made = 0;
  for (const d of deals) {
    if (off.has(d.companyId) || !isOpenStage(d.stage)) continue;
    if (d.closeNudgedFor && d.closeNudgedFor.getTime() === d.expectedClose!.getTime()) continue;
    const claimed = await db.deal.updateMany({
      where: { id: d.id, expectedClose: d.expectedClose, OR: [{ closeNudgedFor: null }, { closeNudgedFor: { not: d.expectedClose! } }] },
      data: { closeNudgedFor: d.expectedClose },
    });
    if (claimed.count === 0) continue;
    await db.followUp.create({
      data: {
        title: `"${d.title}" was due to close ${shortDay(d.expectedClose!)}: win it, lose it or move the date`.slice(0, 200),
        dueAt: now,
        companyId: d.companyId,
        customerId: d.customerId,
        dealId: d.id,
        assigneeId: assignee(d.ownerId, d.customer.ownerId),
      },
    });
    made += 1;
  }
  return made;
}

/** Each person's reminders for today and anything overdue, emailed once a morning. */
async function morningDigests(now: Date) {
  if (now.getUTCHours() < DIGEST_HOUR_UTC) return 0;
  const today = now.toISOString().slice(0, 10);
  const off = await switchedOff("dailyDigest");
  const endOfToday = new Date(`${today}T23:59:59.999Z`);
  const users = await db.user.findMany({
    where: { OR: [{ digestSentOn: null }, { digestSentOn: { not: today } }] },
    select: { id: true, name: true, email: true, companyId: true },
    take: 300,
  });
  const base = process.env.APP_BASE_URL;
  let sent = 0;
  for (const user of users) {
    // Stamped first, so a slow email can't make a second summary.
    const claimed = await db.user.updateMany({
      where: { id: user.id, OR: [{ digestSentOn: null }, { digestSentOn: { not: today } }] },
      data: { digestSentOn: today },
    });
    if (claimed.count === 0 || off.has(user.companyId)) continue;
    const due = await db.followUp.findMany({
      where: { assigneeId: user.id, doneAt: null, dueAt: { lte: endOfToday } },
      orderBy: { dueAt: "asc" },
      take: 30,
      select: { title: true, dueAt: true, customer: { select: { name: true } } },
    });
    if (due.length === 0) continue;
    const overdue = due.filter((f) => f.dueAt.toISOString().slice(0, 10) < today).length;
    const rows = due
      .map((f) => {
        const late = f.dueAt.toISOString().slice(0, 10) < today;
        return `<li style="margin:4px 0">${escapeHtml(f.title)} <span style="color:#64748b">· ${escapeHtml(f.customer.name)}${late ? ` · <strong style="color:#dc2626">overdue since ${shortDay(f.dueAt)}</strong>` : ""}</span></li>`;
      })
      .join("");
    try {
      await sendEmailForCompany(user.companyId, {
        to: user.email,
        subject: `Your day: ${due.length} ${due.length === 1 ? "reminder" : "reminders"}${overdue ? `, ${overdue} overdue` : ""}`,
        html: `<p>Good morning ${escapeHtml(user.name.split(" ")[0])},</p><p>Here is what's on your list today.</p><ul>${rows}</ul>${
          base ? `<p><a href="${base}/dashboard/crm/reminders">Open your reminders</a></p>` : ""
        }<p style="color:#94a3b8;font-size:12px">An owner or admin can turn this summary off in the CRM settings.</p>`,
      });
      sent += 1;
    } catch (err) {
      console.error(`[crm-auto] morning summary failed for user ${user.id}:`, err);
    }
  }
  return sent;
}

/** The cron's pass over every automatic step. */
export async function runAutoSteps() {
  const now = new Date();
  const out: Record<string, number> = {};
  for (const [name, step] of [
    ["quoteExpiry", quoteExpiryNudges],
    ["dealOverdue", overdueDealNudges],
    ["digests", morningDigests],
  ] as const) {
    try {
      out[name] = await step(now);
    } catch (err) {
      console.error(`[crm-auto] ${name} failed:`, err);
    }
  }
  return out;
}

/** A first accepted quote or order makes a lead an active customer. */
export async function markCustomerActive(customerId: string) {
  try {
    await db.customer.updateMany({ where: { id: customerId, status: "LEAD" }, data: { status: "ACTIVE" } });
  } catch (err) {
    console.error(`[crm-auto] could not mark customer ${customerId} active:`, err);
  }
}
