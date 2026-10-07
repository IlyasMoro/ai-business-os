import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { DonutChart } from "@/components/dash-viz/donut-chart";
import { AnimatedCounter } from "@/components/dash-viz/animated-counter";
import { VIZ } from "@/components/dash-viz/colors";
import { StatusBadge } from "@/components/ui-dark/badge";
import { Plus, Search, Download, Megaphone } from "lucide-react";
import { EmptyState } from "@/components/ui-dark/empty-state";
import { buttonStyles } from "@/components/ui-dark/button";
import { fieldStyles } from "@/components/ui-dark/input";
import { getCampaignsWithStats } from "@/lib/campaign-data";
import { formatRoi, totalStats } from "@/lib/campaign-stats";
import { formatCurrency } from "@/lib/utils";

const statusOrder = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"] as const;
const statusColor: Record<(typeof statusOrder)[number], string> = {
  DRAFT: VIZ.muted,
  ACTIVE: VIZ.emerald,
  PAUSED: VIZ.amber,
  COMPLETED: VIZ.blue,
};

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const session = await verifySession();

  // Totals and the status chart cover every campaign; the search only
  // narrows the table.
  const all = await getCampaignsWithStats(session.companyId);
  const needle = q?.trim().toLowerCase();
  const campaigns = needle ? all.filter((c) => c.name.toLowerCase().includes(needle)) : all;

  const totalAll = all.length;
  const statusMap = new Map<string, number>();
  for (const c of all) statusMap.set(c.status, (statusMap.get(c.status) ?? 0) + 1);
  const totals = totalStats(all.map((c) => c.stats));

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Campaigns</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            {totalAll} campaign{totalAll === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <form method="GET" className="relative w-full min-w-48 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute z-10 left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              name="q"
              placeholder="Search campaigns..."
              defaultValue={q}
              className={fieldStyles("pl-9")}
            />
          </form>
          <a
            href="/api/export/campaigns"
            className={buttonStyles("secondary")}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
          <Link
            href="/dashboard/marketing/new"
            className={buttonStyles("primary")}
          >
            <Plus className="h-4 w-4" />
            New campaign
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.09] light:border-white/80 p-5 lg:col-span-1 glass">
          <p className="text-sm text-slate-400 light:text-slate-500">Spent</p>
          <p className="mt-2 text-2xl font-semibold text-slate-50 light:text-slate-900">
            <AnimatedCounter value={totals.spent} prefix="$" decimals={0} />
          </p>
          <p className="text-xs text-slate-500">of {formatCurrency(totals.budget)} budgeted</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-400 light:text-slate-500">Leads</p>
              <p className="mt-1 text-xl font-semibold text-slate-50 light:text-slate-900">
                <AnimatedCounter value={totals.leads} decimals={0} />
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400 light:text-slate-500">Revenue</p>
              <p className="mt-1 text-xl font-semibold text-slate-50 light:text-slate-900">
                <AnimatedCounter value={totals.revenue} prefix="$" decimals={0} />
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-400 light:text-slate-500">Return on spend</p>
          <p
            className={`mt-1 text-xl font-semibold ${
              totals.roiPct === null ? "text-slate-50 light:text-slate-900" : totals.roiPct >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {formatRoi(totals.roiPct)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.09] light:border-white/80 p-6 lg:col-span-2 glass">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-center">
            <DonutChart
              title="Campaigns by status"
              centerValue={String(totalAll)}
              centerLabel="campaigns"
              slices={statusOrder.map((status) => ({
                label: status.charAt(0) + status.slice(1).toLowerCase(),
                value: statusMap.get(status) ?? 0,
                color: statusColor[status],
              }))}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.09] light:border-white/80 glass">
        {campaigns.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={q ? "No campaigns match your search" : "No campaigns yet"}
            description={q ? "Try a different search term, or clear it to see everything." : "Create a campaign to plan outreach and measure results."}
            action={q ? { href: "/dashboard/marketing", label: "Clear search", variant: "secondary" } : { href: "/dashboard/marketing/new", label: "New campaign" }}
          />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Campaign</th>
                <th className="px-5 py-3 font-medium">Channel</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Spent</th>
                <th className="px-5 py-3 text-right font-medium">Leads</th>
                <th className="px-5 py-3 text-right font-medium">Revenue</th>
                <th className="px-5 py-3 text-right font-medium">Return</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/marketing/${campaign.id}`}
                      className="font-semibold text-slate-50 light:text-slate-900 hover:text-blue-400"
                    >
                      {campaign.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">
                    {campaign.channel.charAt(0) + campaign.channel.slice(1).toLowerCase()}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={campaign.status} color={statusColor[campaign.status]} />
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-300 light:text-slate-600">
                    {formatCurrency(campaign.stats.spent)}
                    <span className="block text-xs text-slate-500">of {formatCurrency(campaign.stats.budget)}</span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-300 light:text-slate-600">{campaign.stats.leads}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-300 light:text-slate-600">{formatCurrency(campaign.stats.revenue)}</td>
                  <td
                    className={`px-5 py-3 text-right tabular-nums ${
                      campaign.stats.roiPct === null
                        ? "text-slate-500"
                        : campaign.stats.roiPct >= 0
                          ? "text-emerald-400 light:text-emerald-700"
                          : "text-red-400 light:text-red-700"
                    }`}
                  >
                    {formatRoi(campaign.stats.roiPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
