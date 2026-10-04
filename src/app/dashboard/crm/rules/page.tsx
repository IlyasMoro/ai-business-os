import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/plan-limits";
import { CrmTabs } from "@/components/crm/crm-tabs";
import { PlanGate } from "@/components/billing/plan-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-dark/card";
import { RuleForm } from "@/components/crm/rule-form";
import { RuleCard } from "@/components/crm/rule-card";
import { cleanRule, describeRule, MAX_RULES, STARTER_RULES } from "@/lib/crm-rules";
import { addStarterRule, deleteRule, saveRule, setRuleActive } from "@/lib/actions/crm-rules";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { Plus } from "lucide-react";

export const metadata = { title: "CRM rules" };


/** "When this happens, do that" rules. Owners and admins, Growth and up. */
export default async function RulesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { saved } = await searchParams;
  const allowed = await hasFeature(session.companyId, "automation");

  const header = (
    <>
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Rules</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">When something happens in the CRM, AIBOS does the next step for you.</p>
      <CrmTabs active="/dashboard/crm/rules" />
    </>
  );
  if (!allowed) {
    return (
      <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
        {header}
        <PlanGate feature="automation">{null}</PlanGate>
      </div>
    );
  }

  const [rules, users, tags, sequences, runs] = await Promise.all([
    db.crmRule.findMany({ where: { companyId: session.companyId }, orderBy: [{ active: "desc" }, { createdAt: "asc" }] }),
    db.user.findMany({ where: { companyId: session.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.customerTag.findMany({ where: { companyId: session.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.emailSequence.findMany({ where: { companyId: session.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.crmRuleRun.groupBy({ by: ["ruleId"], where: { rule: { companyId: session.companyId } }, _count: { _all: true }, _max: { createdAt: true } }),
  ]);
  const names = {
    users: new Map(users.map((u) => [u.id, u.name])),
    tags: new Map(tags.map((t) => [t.id, t.name])),
    sequences: new Map(sequences.map((s) => [s.id, s.name])),
  };
  const runsBy = new Map(runs.map((r) => [r.ruleId, r]));
  // Ready made rules not added yet; the welcome rule needs a sequence that's on.
  const liveSequence = await db.emailSequence.findFirst({
    where: { companyId: session.companyId, active: true, steps: { some: {} } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  const taken = new Set(rules.map((r) => r.name));
  const starters = STARTER_RULES.filter((s) => !taken.has(s.rule.name)).map((s) => {
    const rule = cleanRule(s.needs === "sequence" && liveSequence ? { ...s.rule, sequenceId: liveSequence.id } : s.rule);
    const sentence =
      s.needs === "sequence" && !liveSequence
        ? "When a new lead comes in, put them in your welcome email sequence. Switch on a sequence first."
        : describeRule(rule, names);
    return { id: s.id, name: s.rule.name, sentence, ready: s.needs !== "sequence" || Boolean(liveSequence) };
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      {header}
      {saved && (
        <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 light:text-emerald-700">Rule saved.</div>
      )}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-3">
          {rules.length === 0 && (
            <div className="rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
              <p className="font-semibold text-slate-50 light:text-slate-900">No rules yet</p>
              <p className="mt-1 text-sm text-slate-400 light:text-slate-500">Add a ready made rule below, or write your own.</p>
            </div>
          )}
          {rules.map((rule) => {
              const run = runsBy.get(rule.id);
              return (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  sentence={describeRule(rule, names)}
                  runs={run?._count._all ?? 0}
                  lastRun={run?._max.createdAt ? run._max.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null}
                  save={saveRule.bind(null, rule.id)}
                  toggle={setRuleActive.bind(null, rule.id, !rule.active)}
                  remove={deleteRule.bind(null, rule.id)}
                  users={users}
                  tags={tags}
                  sequences={sequences}
                />
              );
            })}

          {starters.length > 0 && rules.length < MAX_RULES && (
            <div className="pt-3">
              <p className="mb-2 text-sm font-semibold text-slate-200 light:text-slate-700">Ready made rules</p>
              <div className="grid gap-3 md:grid-cols-2">
                {starters.map((s) => (
                  <div key={s.id} className="flex flex-col rounded-xl border border-dashed border-white/[0.14] p-4 light:border-slate-300">
                    <p className="text-sm font-semibold text-slate-50 light:text-slate-900">{s.name}</p>
                    <p className="mt-1 flex-1 text-sm text-slate-400 light:text-slate-500">{s.sentence}</p>
                    {s.ready && (
                      <form action={addStarterRule.bind(null, s.id)} className="mt-3">
                        <SubmitButton variant="secondary" pendingText="Adding...">
                          <Plus className="h-4 w-4" />
                          Add this rule
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New rule</CardTitle>
          </CardHeader>
          <CardContent>
            {rules.length >= MAX_RULES ? (
              <p className="text-sm text-slate-400">You have {MAX_RULES} rules, the most a company can have. Remove one to add another.</p>
            ) : (
              <RuleForm action={saveRule.bind(null, null)} users={users} tags={tags} sequences={sequences} submitLabel="Add rule" />
            )}
            <p className="mt-4 text-xs text-slate-500">
              Each rule runs once per deal, quote or customer, and notes what it did on the customer&apos;s history. Quiet customers are checked every 15
              minutes.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
