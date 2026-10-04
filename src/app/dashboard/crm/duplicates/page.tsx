import { CheckCircle2 } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { BackButton } from "@/components/ui-dark/back-button";
import { EmptyState } from "@/components/ui-dark/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { DuplicateGroup, type DuplicateRecord } from "@/components/crm/duplicate-group";
import { findDuplicateGroups, REASON_LABELS } from "@/lib/crm-duplicates";
import { dismissDuplicates, mergeCustomers } from "@/lib/actions/duplicates";

export const metadata = { title: "Duplicate customers" };

/** Most groups shown at once; merging some brings up the next. */
const SHOW = 25;

/** Customers that share an email, a phone number or a name, grouped, with
 * a merge for each group. Owners and admins only. */
export default async function DuplicatesPage({ searchParams }: { searchParams: Promise<{ error?: string; dismissed?: string }> }) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { error, dismissed } = await searchParams;

  const [customers, dismissals] = await Promise.all([
    db.customer.findMany({ where: { companyId: session.companyId }, select: { id: true, name: true, email: true, phone: true } }),
    db.duplicateDismissal.findMany({ where: { companyId: session.companyId }, select: { key: true } }),
  ]);
  const groups = findDuplicateGroups(customers, new Set(dismissals.map((d) => d.key)));
  const shown = groups.slice(0, SHOW);
  const ids = shown.flatMap((g) => g.ids);

  const [details, deals, orders, activities, quotes] = await Promise.all([
    db.customer.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true, phone: true, company: true, createdAt: true, owner: { select: { name: true } } },
    }),
    db.deal.groupBy({ by: ["customerId"], where: { customerId: { in: ids } }, _count: { _all: true } }),
    db.order.groupBy({ by: ["customerId"], where: { customerId: { in: ids } }, _count: { _all: true } }),
    db.crmActivity.groupBy({ by: ["customerId"], where: { customerId: { in: ids } }, _count: { _all: true } }),
    db.quote.groupBy({ by: ["customerId"], where: { customerId: { in: ids } }, _count: { _all: true } }),
  ]);
  const count = (rows: { customerId: string; _count: { _all: number } }[]) => new Map(rows.map((r) => [r.customerId, r._count._all]));
  const [dealCount, orderCount, activityCount, quoteCount] = [count(deals), count(orders), count(activities), count(quotes)];
  const byId = new Map(details.map((d) => [d.id, d]));

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <BackButton href="/dashboard/crm" label="Back to customers" />
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Duplicate customers</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-400 light:text-slate-500">
        Customers sharing an email, a phone number or a name. Merging moves their deals, history, reminders, quotes, orders, invoices, tickets and
        documents onto the record you keep, so nothing is lost. A merge can&apos;t be undone.
      </p>

      <div className="mt-4 space-y-3">
        <ErrorBanner code={error} />
        {dismissed && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 light:text-emerald-700">
            Got it. That group won&apos;t be suggested again.
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/[0.09] glass light:border-white/80">
          <EmptyState
            icon={CheckCircle2}
            title="No duplicates found"
            description="No two customers share an email, a phone number or a name."
            action={{ href: "/dashboard/crm", label: "Back to customers", variant: "secondary" }}
          />
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-slate-300 light:text-slate-600">
            {groups.length} {groups.length === 1 ? "group" : "groups"} to check
            {groups.length > SHOW ? `, showing the first ${SHOW}` : ""}.
          </p>
          <div className="mt-3 space-y-4">
            {shown.map((group) => {
              const records: DuplicateRecord[] = group.ids
                .map((id) => byId.get(id))
                .filter((d): d is NonNullable<typeof d> => Boolean(d))
                .map((d) => ({
                  id: d.id,
                  name: d.name,
                  email: d.email,
                  phone: d.phone,
                  company: d.company,
                  owner: d.owner?.name ?? null,
                  createdAt: d.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
                  deals: dealCount.get(d.id) ?? 0,
                  orders: orderCount.get(d.id) ?? 0,
                  activities: activityCount.get(d.id) ?? 0,
                  quotes: quoteCount.get(d.id) ?? 0,
                }));
              if (records.length < 2) return null;
              // Suggest keeping the record with the most going on, the oldest on a tie.
              const weight = (r: DuplicateRecord) => r.deals * 3 + r.orders * 3 + r.quotes * 2 + r.activities;
              const created = (id: string) => byId.get(id)!.createdAt.getTime();
              const suggested = [...records].sort((a, b) => weight(b) - weight(a) || created(a.id) - created(b.id))[0];
              return (
                <DuplicateGroup
                  key={group.key}
                  records={records}
                  reasons={group.reasons.map((r) => REASON_LABELS[r])}
                  suggestedKeepId={suggested.id}
                  merge={mergeCustomers}
                  dismiss={dismissDuplicates}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
