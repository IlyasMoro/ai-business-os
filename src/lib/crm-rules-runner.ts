import "server-only";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/plan-limits";
import { sendEmailForCompany } from "@/lib/email-for-company";
import { enrollCustomers } from "@/lib/sequence-enroll";
import { touchLeadScore } from "@/lib/lead-score-data";
import { Prisma } from "@/generated/prisma/client";
import { reminderDue, stageTriggers, type RuleTrigger } from "@/lib/crm-rules";
import type { DealStage } from "@/lib/crm-pipeline";

/* Runs the company's CRM rules when something happens. Rules come with
   Automations (Growth and up). Each rule fires once per thing (a deal, a
   quote, a customer's quiet spell), recorded in CrmRuleRun, and notes on
   the customer's history what it did. A rule that fails is logged and
   skipped: it never stops the person's own action. */

export type RuleEvent = {
  trigger: RuleTrigger;
  companyId: string;
  customerId: string;
  dealId?: string | null;
  /** DEAL_STAGE: the stage entered. */
  stage?: DealStage;
  /** Makes the rule fire once per thing, e.g. "deal:<id>:WON". */
  key: string;
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Rule = Awaited<ReturnType<typeof db.crmRule.findMany>>[number];

/** The customer's owner, or the rule's chosen person if still in the company. */
async function personFor(rule: Rule, companyId: string, ownerId: string | null) {
  const id = rule.assigneeId ?? ownerId;
  if (!id) return null;
  return db.user.findFirst({ where: { id, companyId }, select: { id: true, name: true, email: true } });
}

async function apply(rule: Rule, event: RuleEvent): Promise<string | null> {
  const customer = await db.customer.findFirst({
    where: { id: event.customerId, companyId: event.companyId },
    select: { id: true, name: true, ownerId: true },
  });
  if (!customer) return null;

  switch (rule.action) {
    case "CREATE_REMINDER": {
      const person = await personFor(rule, event.companyId, customer.ownerId);
      const title = (rule.title ?? "Follow up").replace(/\{\{\s*customer\s*\}\}/gi, customer.name).slice(0, 200);
      await db.followUp.create({
        data: {
          title,
          dueAt: reminderDue(new Date(), rule.dueInDays ?? 0),
          companyId: event.companyId,
          customerId: customer.id,
          dealId: event.dealId ?? null,
          assigneeId: person?.id ?? null,
        },
      });
      return `added the reminder "${title}"${person ? ` for ${person.name}` : ""}`;
    }
    case "EMAIL_PERSON": {
      const person = await personFor(rule, event.companyId, customer.ownerId);
      if (!person) return null;
      const base = process.env.APP_BASE_URL;
      const link = event.dealId ? `/dashboard/crm/deals/${event.dealId}` : `/dashboard/crm/${customer.id}`;
      const message = (rule.message ?? "").replace(/\{\{\s*customer\s*\}\}/gi, customer.name);
      await sendEmailForCompany(event.companyId, {
        to: person.email,
        subject: `${rule.name}: ${customer.name}`,
        html: `<p>Hi ${escapeHtml(person.name)},</p><p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>${
          base ? `<p><a href="${base}${link}">Open ${escapeHtml(customer.name)} in AIBOS</a></p>` : ""
        }`,
      });
      return `emailed ${person.name}`;
    }
    case "ADD_TAG": {
      if (!rule.tagId) return null;
      const tag = await db.customerTag.findFirst({ where: { id: rule.tagId, companyId: event.companyId }, select: { id: true, name: true } });
      if (!tag) return null;
      await db.customer.update({ where: { id: customer.id }, data: { tags: { connect: { id: tag.id } } } });
      return `added the tag ${tag.name}`;
    }
    case "SET_STATUS": {
      if (!rule.status) return null;
      await db.customer.update({ where: { id: customer.id }, data: { status: rule.status } });
      return `set the status to ${rule.status.charAt(0)}${rule.status.slice(1).toLowerCase()}`;
    }
    case "ADD_TO_SEQUENCE": {
      if (!rule.sequenceId) return null;
      const { added, sequence } = await enrollCustomers(event.companyId, null, rule.sequenceId, [customer.id]);
      return added > 0 && sequence ? `put them in the sequence "${sequence.name}"` : null;
    }
  }
}

/** Runs one rule for one event, once: claims the run, does the action and
 * notes it on the history. Returns whether it did something. */
async function runOne(rule: Rule, event: RuleEvent): Promise<boolean> {
  try {
    await db.crmRuleRun.create({ data: { ruleId: rule.id, key: event.key } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
  try {
    const did = await apply(rule, event);
    if (!did) return false;
    await db.crmActivity.create({
      data: {
        type: "NOTE",
        body: `Rule "${rule.name}" ${did}.`,
        companyId: event.companyId,
        customerId: event.customerId,
        dealId: event.dealId ?? null,
      },
    });
    await touchLeadScore(event.companyId, event.customerId);
    return true;
  } catch (err) {
    console.error(`[crm-rules] rule ${rule.id} failed for ${event.key}:`, err);
    return false;
  }
}

/** Runs every matching rule for one event. Never throws. */
export async function fireRules(event: RuleEvent): Promise<void> {
  try {
    if (!(await hasFeature(event.companyId, "automation"))) return;
    const rules = await db.crmRule.findMany({
      where: {
        companyId: event.companyId,
        active: true,
        trigger: event.trigger,
        ...(event.trigger === "DEAL_STAGE" ? { stage: event.stage } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    for (const rule of rules) await runOne(rule, event);
  } catch (err) {
    console.error(`[crm-rules] ${event.trigger} failed for ${event.key}:`, err);
  }
}

/** A deal entered a stage: the stage rules, plus won or lost. */
export async function dealStageChanged(companyId: string, deal: { id: string; customerId: string }, stage: DealStage) {
  for (const trigger of stageTriggers(stage)) {
    await fireRules({
      trigger,
      companyId,
      customerId: deal.customerId,
      dealId: deal.id,
      stage,
      key: trigger === "DEAL_STAGE" ? `deal:${deal.id}:${stage}` : `deal:${deal.id}:${trigger}`,
    });
  }
}

/** The cron's pass for "a customer goes quiet": customers with nothing on
 * their history for the rule's number of days. Fires once per quiet spell,
 * keyed on the last entry. The rule's own note starts a new spell, so it
 * fires again every that many days while they stay quiet. */
export async function runQuietRules() {
  const rules = await db.crmRule.findMany({ where: { active: true, trigger: "CUSTOMER_QUIET", quietDays: { not: null } } });
  const allowed = new Map<string, boolean>();
  let fired = 0;
  for (const rule of rules) {
    if (!allowed.has(rule.companyId)) allowed.set(rule.companyId, await hasFeature(rule.companyId, "automation"));
    if (!allowed.get(rule.companyId)) continue;
    const cutoff = new Date(Date.now() - rule.quietDays! * 24 * 60 * 60 * 1000);
    const candidates = await db.customer.findMany({
      where: {
        companyId: rule.companyId,
        status: { not: "INACTIVE" },
        createdAt: { lt: cutoff },
        crmActivities: { none: { occurredAt: { gte: cutoff } } },
      },
      select: { id: true, createdAt: true },
      take: 300,
    });
    if (candidates.length === 0) continue;
    const last = await db.crmActivity.groupBy({
      by: ["customerId"],
      where: { customerId: { in: candidates.map((c) => c.id) } },
      _max: { occurredAt: true },
    });
    const lastById = new Map(last.map((l) => [l.customerId, l._max.occurredAt]));
    for (const c of candidates) {
      const since = lastById.get(c.id) ?? c.createdAt;
      const key = `quiet:${c.id}:${since.toISOString().slice(0, 10)}`;
      if (await runOne(rule, { trigger: "CUSTOMER_QUIET", companyId: rule.companyId, customerId: c.id, key })) fired += 1;
    }
  }
  return fired;
}
