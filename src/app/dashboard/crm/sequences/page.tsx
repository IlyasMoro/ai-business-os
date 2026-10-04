import Link from "next/link";
import { Send } from "lucide-react";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/plan-limits";
import { CrmTabs } from "@/components/crm/crm-tabs";
import { PlanGate } from "@/components/billing/plan-gate";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Badge } from "@/components/ui-dark/badge";
import { EmptyState } from "@/components/ui-dark/empty-state";
import { Input } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { createSequence } from "@/lib/actions/sequences";

export const metadata = { title: "Email sequences" };

/** Every email sequence with how it's doing; owners and admins add new ones. */
export default async function SequencesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await verifySession();
  const { error } = await searchParams;
  const isAdmin = hasRole(session, ["OWNER", "ADMIN"]);
  const allowed = await hasFeature(session.companyId, "automation");

  const sequences = allowed
    ? await db.emailSequence.findMany({
        where: { companyId: session.companyId },
        orderBy: [{ active: "desc" }, { name: "asc" }],
        select: { id: true, name: true, active: true, _count: { select: { steps: true } } },
      })
    : [];
  const counts = allowed
    ? await db.sequenceEnrollment.groupBy({ by: ["sequenceId", "status"], where: { companyId: session.companyId }, _count: { _all: true } })
    : [];
  const countOf = (sequenceId: string, status: string) => counts.find((c) => c.sequenceId === sequenceId && c.status === status)?._count._all ?? 0;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Email sequences</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        A few emails sent days apart, stopping on their own when the customer replies or unsubscribes.
      </p>
      <CrmTabs active="/dashboard/crm/sequences" />

      {!allowed ? (
        <PlanGate feature="automation">{null}</PlanGate>
      ) : (
        <>
          <div className="mt-4">
            <ErrorBanner code={error} />
          </div>

          {isAdmin && (
            <form action={createSequence} className="mt-4 flex max-w-xl flex-wrap items-center gap-2">
              <Input name="name" required maxLength={80} placeholder="Name a new sequence, for example New lead welcome" aria-label="Sequence name" className="min-w-0 flex-1" />
              <SubmitButton pendingText="Creating...">New sequence</SubmitButton>
            </form>
          )}

          <div className="mt-6 rounded-2xl border border-white/[0.09] glass light:border-white/80">
            {sequences.length === 0 ? (
              <EmptyState
                icon={Send}
                title="No sequences yet"
                description={
                  isAdmin
                    ? "Name one above, write its emails, then switch it on and add customers."
                    : "An owner or admin can set one up. Then you can add your customers to it."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-left text-slate-500 light:border-slate-200">
                      <th className="px-5 py-3 font-medium">Sequence</th>
                      <th className="px-5 py-3 font-medium">Emails</th>
                      <th className="px-5 py-3 text-right font-medium">In progress</th>
                      <th className="px-5 py-3 text-right font-medium">Replied</th>
                      <th className="px-5 py-3 text-right font-medium">Finished</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sequences.map((s) => (
                      <tr key={s.id} className="border-b border-white/[0.04] last:border-0">
                        <td className="px-5 py-3">
                          <Link href={`/dashboard/crm/sequences/${s.id}`} className="font-semibold text-slate-50 hover:text-blue-400 light:text-slate-900">
                            {s.name}
                          </Link>
                        </td>
                        <td className="px-5 py-3 tabular-nums text-slate-400 light:text-slate-500">{s._count.steps}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-300 light:text-slate-600">{countOf(s.id, "ACTIVE")}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-300 light:text-slate-600">{countOf(s.id, "REPLIED")}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-300 light:text-slate-600">{countOf(s.id, "COMPLETED")}</td>
                        <td className="px-5 py-3">{s.active ? <Badge tone="green">On</Badge> : <Badge tone="slate">Off</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
