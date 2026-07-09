import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { DonutChart } from "@/components/dash-viz/donut-chart";
import { AnimatedCounter } from "@/components/dash-viz/animated-counter";
import { VIZ } from "@/components/dash-viz/colors";
import { Plus } from "lucide-react";

const statusOrder = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"] as const;
const statusColor: Record<(typeof statusOrder)[number], string> = {
  DRAFT: VIZ.muted,
  ACTIVE: VIZ.emerald,
  PAUSED: VIZ.amber,
  COMPLETED: VIZ.blue,
};

export default async function MarketingPage() {
  const session = await verifySession();

  const [campaigns, statusGroups] = await Promise.all([
    db.campaign.findMany({
      where: { companyId: session.companyId },
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
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Marketing</h1>
          <p className="mt-1 text-sm text-slate-400">
            {totalAll} campaign{totalAll === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/dashboard/marketing/new"
          className="inline-flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
        >
          <Plus className="h-4 w-4" />
          New campaign
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-5 lg:col-span-1">
          <p className="text-sm text-slate-400">Total budget</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-400">
            <AnimatedCounter value={totalBudget} prefix="$" decimals={0} />
          </p>
          <p className="mt-4 text-sm text-slate-400">Total leads generated</p>
          <p className="mt-2 text-2xl font-semibold text-slate-50">
            <AnimatedCounter value={totalLeads} decimals={0} />
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-6 lg:col-span-2">
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

      <div className="mt-6 rounded-2xl border border-white/[0.06] bg-[#111111]">
        {campaigns.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No campaigns yet. Create your first one to get started.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-slate-500">
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
                      className="font-medium text-slate-50 hover:text-blue-400"
                    >
                      {campaign.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-400">
                    {campaign.channel.charAt(0) + campaign.channel.slice(1).toLowerCase()}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-medium"
                      style={{ color: statusColor[campaign.status] }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: statusColor[campaign.status] }}
                      />
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono tabular-nums text-slate-300">
                    ${campaign.budget.toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-slate-300">{campaign._count.leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
