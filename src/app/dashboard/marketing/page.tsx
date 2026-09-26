import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { DonutChart } from "@/components/dash-viz/donut-chart";
import { AnimatedCounter } from "@/components/dash-viz/animated-counter";
import { VIZ } from "@/components/dash-viz/colors";
import { StatusBadge } from "@/components/ui-dark/badge";
import { Plus, Search, Download, Megaphone } from "lucide-react";
import { EmptyState } from "@/components/ui-dark/empty-state";
import { buttonStyles } from "@/components/ui-dark/button";
import { fieldStyles } from "@/components/ui-dark/input";

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

  const where: Prisma.CampaignWhereInput = {
    companyId: session.companyId,
    ...(q ? { name: { contains: q } } : {}),
  };

  const [campaigns, statusGroups] = await Promise.all([
    db.campaign.findMany({
      where,
      include: { _count: { select: { leads: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.campaign.groupBy({
      by: ["status"],
      where: { companyId: session.companyId },
      _count: { _all: true },
      _sum: { budget: true },
    }),
  ]);

  const totalAll = statusGroups.reduce((s, g) => s + g._count._all, 0);
  const statusMap = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const totalBudget = statusGroups.reduce((s, g) => s + (g._sum.budget ?? 0), 0);
  const totalLeads = campaigns.reduce((s, c) => s + c._count.leads, 0);

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
          <p className="text-sm text-slate-400 light:text-slate-500">Total budget</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-400">
            <AnimatedCounter value={totalBudget} prefix="$" decimals={0} />
          </p>
          <p className="mt-4 text-sm text-slate-400 light:text-slate-500">Total leads generated</p>
          <p className="mt-2 text-2xl font-semibold text-slate-50 light:text-slate-900">
            <AnimatedCounter value={totalLeads} decimals={0} />
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Campaign</th>
                <th className="px-5 py-3 font-medium">Channel</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Budget</th>
                <th className="px-5 py-3 font-medium">Leads</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/marketing/${campaign.id}`}
                      className="font-medium text-slate-50 light:text-slate-900 hover:text-blue-400"
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
                  <td className="px-5 py-3 font-mono tabular-nums text-slate-300 light:text-slate-600">
                    ${campaign.budget.toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-slate-300 light:text-slate-600">{campaign._count.leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
