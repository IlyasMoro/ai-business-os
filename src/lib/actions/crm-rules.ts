"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireFeature } from "@/lib/plan-limits";
import { cleanRule, MAX_RULES, ruleProblem, RuleInputSchema, STARTER_RULES } from "@/lib/crm-rules";

/* CRM rules: owners and admins write them; they come with Automations
   (Growth and up). */

const PAGE = "/dashboard/crm/rules";

export type RuleFormState = { error?: string } | undefined;

async function gate() {
  const session = await requireRole(["OWNER", "ADMIN"]);
  await requireFeature(session.companyId, "automation", PAGE);
  return session;
}

const field = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" ? v : undefined;
};

/** Reads and checks the form, including that the chosen person, tag and
 * sequence belong to this company. */
async function readRule(companyId: string, formData: FormData) {
  const parsed = RuleInputSchema.safeParse(
    Object.fromEntries(
      ["name", "trigger", "stage", "quietDays", "action", "title", "dueInDays", "assigneeId", "tagId", "sequenceId", "status", "message"].map((k) => [
        k,
        field(formData, k),
      ])
    )
  );
  if (!parsed.success) return { error: "Give the rule a name and choose what starts it and what it does." } as const;
  const problem = ruleProblem(parsed.data);
  if (problem) return { error: problem } as const;
  const data = cleanRule(parsed.data);

  const [user, tag, sequence] = await Promise.all([
    data.assigneeId ? db.user.findFirst({ where: { id: data.assigneeId, companyId }, select: { id: true } }) : true,
    data.tagId ? db.customerTag.findFirst({ where: { id: data.tagId, companyId }, select: { id: true } }) : true,
    data.sequenceId ? db.emailSequence.findFirst({ where: { id: data.sequenceId, companyId }, select: { id: true } }) : true,
  ]);
  if (!user || !tag || !sequence) return { error: "Something chosen in the rule no longer exists. Pick it again." } as const;
  return { data } as const;
}

export async function saveRule(ruleId: string | null, _state: RuleFormState, formData: FormData): Promise<RuleFormState> {
  const session = await gate();
  const result = await readRule(session.companyId, formData);
  if ("error" in result) return { error: result.error };

  if (ruleId) {
    const updated = await db.crmRule.updateMany({ where: { id: ruleId, companyId: session.companyId }, data: result.data });
    if (updated.count === 0) return { error: "This rule was deleted." };
    await logAudit(session.companyId, session.userId, "crm_rule.updated", "CrmRule", ruleId, { name: result.data.name });
  } else {
    if ((await db.crmRule.count({ where: { companyId: session.companyId } })) >= MAX_RULES) {
      return { error: `You can have up to ${MAX_RULES} rules. Remove one you no longer use first.` };
    }
    const rule = await db.crmRule.create({ data: { ...result.data, companyId: session.companyId } });
    await logAudit(session.companyId, session.userId, "crm_rule.created", "CrmRule", rule.id, { name: rule.name });
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?saved=1`);
}

/** Adds one of the ready made rules. The welcome rule uses the first email
 * sequence that's switched on. */
export async function addStarterRule(starterId: string) {
  const session = await gate();
  const starter = STARTER_RULES.find((s) => s.id === starterId);
  if (!starter) return;
  if ((await db.crmRule.count({ where: { companyId: session.companyId } })) >= MAX_RULES) return;
  let rule = starter.rule;
  if (starter.needs === "sequence") {
    const sequence = await db.emailSequence.findFirst({
      where: { companyId: session.companyId, active: true, steps: { some: {} } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!sequence) return;
    rule = { ...rule, sequenceId: sequence.id };
  }
  const created = await db.crmRule.create({ data: { ...cleanRule(rule), companyId: session.companyId } });
  await logAudit(session.companyId, session.userId, "crm_rule.created", "CrmRule", created.id, { name: created.name, starter: starterId });
  revalidatePath(PAGE);
}

export async function setRuleActive(ruleId: string, active: boolean) {
  const session = await gate();
  await db.crmRule.updateMany({ where: { id: ruleId, companyId: session.companyId }, data: { active } });
  revalidatePath(PAGE);
}

export async function deleteRule(ruleId: string) {
  const session = await gate();
  const rule = await db.crmRule.findFirst({ where: { id: ruleId, companyId: session.companyId }, select: { name: true } });
  if (!rule) return;
  await db.crmRule.delete({ where: { id: ruleId } });
  await logAudit(session.companyId, session.userId, "crm_rule.deleted", "CrmRule", ruleId, { name: rule.name });
  revalidatePath(PAGE);
}
