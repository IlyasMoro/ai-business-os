import Link from "next/link";
import { Plus } from "lucide-react";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { CrmTabs } from "@/components/crm/crm-tabs";
import { DealBoard } from "@/components/crm/deal-board";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LinkButton } from "@/components/ui-dark/button";
import { isOpenStage, pipelineSummary } from "@/lib/crm-pipeline";
import { cn } from "@/lib/utils";

export const metadata = { title: "Deals" };

function money(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** The sales pipeline: summary figures, then the drag and drop board. */
export default async function DealsPage({ searchParams }: { searchParams: Promise<{ mine?: string; error?: string }> }) {
  const session = await verifySession();
  const { mine, error } = await searchParams;
  const onlyMine = mine === "1";

  const deals = await db.deal.findMany({
    where: { companyId: session.companyId, ...(onlyMine ? { ownerId: session.userId } : {}) },
    select: {
      id: true,
      title: true,
      value: true,
      stage: true,
      probability: true,
      position: true,
      expectedClose: true,
      closedAt: true,
      customer: { select: { name: true } },
      owner: { select: { name: true } },
    },
  });

  const summary = pipelineSummary(deals);
  const now = new Date();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const closingThisMonth = deals.filter(
    (d) => isOpenStage(d.stage) && d.expectedClose && d.expectedClose < monthEnd
  );

  const stats = [
    { label: "Open pipeline", value: money(summary.openValue), note: `${summary.openCount} open ${summary.openCount === 1 ? "deal" : "deals"}` },
    { label: "Weighted forecast", value: money(summary.weightedValue), note: "Each deal times its chance of winning" },
    { label: "Win rate", value: summary.winRate === null ? "n/a" : `${summary.winRate}%`, note: "Of deals won or lost" },
    {
      label: "Closing this month",
      value: money(closingThisMonth.reduce((s, d) => s + d.value, 0)),
      note: `${closingThisMonth.length} expected to close by month end`,
    },
  ];

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Deals</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">Drag a deal to move it to another stage.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1 text-sm light:border-slate-200 light:bg-slate-100">
            {[
              { href: "/dashboard/crm/deals", label: "All deals", on: !onlyMine },
              { href: "/dashboard/crm/deals?mine=1", label: "My deals", on: onlyMine },
            ].map((f) => (
              <Link
                key={f.label}
                href={f.href}
                aria-current={f.on ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                  f.on ? "bg-blue-600 font-medium text-white" : "text-slate-300 hover:text-white light:text-slate-600 light:hover:text-slate-900"
                )}
              >
                {f.label}
              </Link>
            ))}
          </div>
          <LinkButton href="/dashboard/crm/deals/new">
            <Plus className="h-4 w-4" />
            New deal
          </LinkButton>
        </div>
      </div>

      <CrmTabs active="/dashboard/crm/deals" />
      <div className="mt-4">
        <ErrorBanner code={error} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.09] p-4 glass light:border-white/80">
            <p className="text-xs text-slate-400 light:text-slate-500">{s.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-50 light:text-slate-900">{s.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{s.note}</p>
          </div>
        ))}
      </div>

      {deals.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-white/15 p-10 text-center light:border-slate-300">
          <p className="font-semibold text-slate-100 light:text-slate-800">{onlyMine ? "You have no deals yet" : "No deals yet"}</p>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            Add a deal for a customer to start tracking it from first contact to signed.
          </p>
          <div className="mt-4">
            <LinkButton href="/dashboard/crm/deals/new">
              <Plus className="h-4 w-4" />
              New deal
            </LinkButton>
          </div>
        </div>
      ) : (
        <DealBoard
          deals={deals.map((d) => ({
            id: d.id,
            title: d.title,
            value: d.value,
            stage: d.stage,
            probability: d.probability,
            position: d.position,
            expectedClose: d.expectedClose?.toISOString() ?? null,
            customerName: d.customer.name,
            ownerName: d.owner?.name ?? null,
          }))}
        />
      )}
    </div>
  );
}
