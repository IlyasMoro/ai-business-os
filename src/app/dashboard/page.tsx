import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { ErrorBanner } from "@/components/ui/error-banner";
import { KpiCard } from "@/components/dash-viz/kpi-card";
import { RingGauge } from "@/components/dash-viz/ring-gauge";
import { PulseClock } from "@/components/dash-viz/pulse-clock";
import { AllocationBar } from "@/components/dash-viz/allocation-bar";
import { ActivityTimeline, type TimelineItem } from "@/components/dash-viz/activity-timeline";
import { VIZ } from "@/components/dash-viz/colors";
import { subMonths, startOfMonth, endOfMonth, formatDistanceToNow } from "date-fns";
import {
  Users,
  ShoppingCart,
  Boxes,
  Receipt,
  LifeBuoy,
  FolderKanban,
  Wallet,
} from "lucide-react";

function monthBuckets(count: number) {
  return Array.from({ length: count }).map((_, i) => startOfMonth(subMonths(new Date(), count - 1 - i)));
}

function runningTotals(monthlyCounts: number[], startingBase: number): number[] {
  return monthlyCounts.reduce<number[]>((acc, count) => {
    const previous = acc.length > 0 ? acc[acc.length - 1] : startingBase;
    acc.push(previous + count);
    return acc;
  }, []);
}

function WidgetsSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl border border-slate-800 bg-slate-900/60" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-slate-800 bg-slate-900/60" />
        ))}
      </div>
      <div className="mt-6 h-64 rounded-2xl border border-slate-800 bg-slate-900/60" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-64 rounded-2xl border border-slate-800 bg-slate-900/60" />
        <div className="h-64 rounded-2xl border border-slate-800 bg-slate-900/60" />
      </div>
    </div>
  );
}

export default async function DashboardOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getCurrentUser();

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-slate-950 p-4 sm:-m-6 sm:p-6">
      <ErrorBanner code={error} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-slate-400">
            Here&apos;s what&apos;s happening at {user.company.name}.
          </p>
        </div>
        <PulseClock />
      </div>

      <Suspense fallback={<WidgetsSkeleton />}>
        <DashboardWidgets companyId={user.companyId} />
      </Suspense>
    </div>
  );
}

async function DashboardWidgets({ companyId }: { companyId: string }) {
  const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
  const months = monthBuckets(6);

  const [
    customerCount,
    openOrderCount,
    products,
    outstandingInvoiceCount,
    openTicketCount,
    incomeTx,
    projectsForTrend,
    customersForTrend,
    projectStatusGroups,
    taskStatusGroups,
    invoiceStatusGroups,
    customerStatusGroups,
    recentAiActions,
    recentAuditLogs,
  ] = await Promise.all([
    db.customer.count({ where: { companyId } }),
    db.order.count({ where: { companyId, status: { in: ["PENDING", "CONFIRMED"] } } }),
    db.product.findMany({ where: { companyId }, select: { stockQty: true, reorderLevel: true } }),
    db.invoice.count({ where: { companyId, status: { in: ["SENT", "OVERDUE"] } } }),
    db.ticket.count({ where: { companyId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.transaction.findMany({
      where: { companyId, type: "INCOME", date: { gte: sixMonthsAgo } },
      select: { amount: true, date: true },
    }),
    db.project.findMany({
      where: { companyId, createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    }),
    db.customer.findMany({
      where: { companyId, createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    }),
    db.project.groupBy({ by: ["status"], where: { companyId }, _count: { _all: true } }),
    db.task.groupBy({
      by: ["status"],
      where: { project: { companyId, status: "ACTIVE" } },
      _count: { _all: true },
    }),
    db.invoice.groupBy({ by: ["status"], where: { companyId }, _count: { _all: true } }),
    db.customer.groupBy({ by: ["status"], where: { companyId }, _count: { _all: true } }),
    db.aiAction.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, summary: true, status: true, createdAt: true, requestedBy: { select: { name: true } } },
    }),
    db.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, action: true, createdAt: true, user: { select: { name: true } } },
    }),
  ]);

  const lowStockCount = products.filter((p) => p.stockQty <= p.reorderLevel).length;
  const projectStatusMap = new Map(projectStatusGroups.map((g) => [g.status, g._count._all]));
  const activeCount = projectStatusMap.get("ACTIVE") ?? 0;
  const completedCount = projectStatusMap.get("COMPLETED") ?? 0;
  const onHoldCount = projectStatusMap.get("ON_HOLD") ?? 0;
  const totalProjects = activeCount + completedCount + onHoldCount;
  const completionRatio = totalProjects > 0 ? (completedCount / totalProjects) * 100 : 0;

  const snapshot = { customerCount, openOrderCount, lowStockCount, outstandingInvoiceCount, openTicketCount, activeProjectCount: activeCount };

  const totalRevenue = incomeTx.reduce((s, t) => s + t.amount, 0);
  const revenueTrend = months.map((m) => {
    const end = endOfMonth(m);
    return incomeTx.filter((t) => t.date >= m && t.date <= end).reduce((s, t) => s + t.amount, 0);
  });

  // Monthly counts converted to running totals, so the sparkline reads as
  // cumulative growth rather than a noisy month-to-month delta.
  const projectsPerMonth = months.map(
    (m) => projectsForTrend.filter((p) => p.createdAt >= m && p.createdAt <= endOfMonth(m)).length
  );
  const projectsCumulative = runningTotals(projectsPerMonth, snapshot.activeProjectCount - projectsForTrend.length);

  const customersPerMonth = months.map(
    (m) => customersForTrend.filter((c) => c.createdAt >= m && c.createdAt <= endOfMonth(m)).length
  );
  const customersCumulative = runningTotals(customersPerMonth, snapshot.customerCount - customersForTrend.length);

  const taskStatusMap = new Map(taskStatusGroups.map((g) => [g.status, g._count._all]));
  const totalActiveProjectTasks = taskStatusGroups.reduce((s, g) => s + g._count._all, 0);
  const doneTaskCount = taskStatusMap.get("DONE") ?? 0;
  const avgTaskCompletion = totalActiveProjectTasks > 0 ? (doneTaskCount / totalActiveProjectTasks) * 100 : 0;

  const invoiceStatusMap = new Map(invoiceStatusGroups.map((g) => [g.status, g._count._all]));
  const paidCount = invoiceStatusMap.get("PAID") ?? 0;
  const sentCount = invoiceStatusMap.get("SENT") ?? 0;
  const overdueCount = invoiceStatusMap.get("OVERDUE") ?? 0;
  const collectibleTotal = paidCount + sentCount + overdueCount;
  const collectionRate = collectibleTotal > 0 ? (paidCount / collectibleTotal) * 100 : 100;

  const customerStatusMap = new Map(customerStatusGroups.map((g) => [g.status, g._count._all]));
  const customerStatusRows = (["LEAD", "ACTIVE", "INACTIVE"] as const).map((status) => ({
    status,
    count: customerStatusMap.get(status) ?? 0,
  }));
  const totalCustomersForBars = customerStatusRows.reduce((s, r) => s + r.count, 0) || 1;
  const customerStatusColor: Record<(typeof customerStatusRows)[number]["status"], string> = {
    LEAD: VIZ.amber,
    ACTIVE: VIZ.emerald,
    INACTIVE: VIZ.muted,
  };

  const timelineItems: TimelineItem[] = [
    ...recentAiActions.map((a) => ({
      id: `ai-${a.id}`,
      title: a.summary,
      meta: `AI proposal · ${a.requestedBy.name} · ${a.status.toLowerCase()}`,
      when: formatDistanceToNow(a.createdAt, { addSuffix: true }),
      tone: (a.status === "EXECUTED"
        ? "emerald"
        : a.status === "REJECTED" || a.status === "FAILED"
          ? "red"
          : "amber") as TimelineItem["tone"],
      createdAt: a.createdAt,
    })),
    ...recentAuditLogs.map((l) => ({
      id: `audit-${l.id}`,
      title: l.action.replace(/\./g, " ").replace(/_/g, " "),
      meta: `by ${l.user.name}`,
      when: formatDistanceToNow(l.createdAt, { addSuffix: true }),
      tone: "blue" as TimelineItem["tone"],
      createdAt: l.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 8);

  const secondaryStats = [
    { label: "Open orders", value: snapshot.openOrderCount, href: "/dashboard/sales", icon: ShoppingCart, alert: false },
    { label: "Low stock", value: snapshot.lowStockCount, href: "/dashboard/inventory", icon: Boxes, alert: snapshot.lowStockCount > 0 },
    { label: "Outstanding invoices", value: snapshot.outstandingInvoiceCount, href: "/dashboard/invoicing", icon: Receipt, alert: snapshot.outstandingInvoiceCount > 0 },
    { label: "Open tickets", value: snapshot.openTicketCount, href: "/dashboard/support", icon: LifeBuoy, alert: snapshot.openTicketCount > 0 },
  ];

  return (
    <>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Revenue (6 months)"
          value={totalRevenue}
          prefix="R"
          decimals={0}
          icon={Wallet}
          color={VIZ.emerald}
          trend={revenueTrend}
        />
        <KpiCard
          label="Active projects"
          value={activeCount}
          icon={FolderKanban}
          color={VIZ.blue}
          trend={projectsCumulative}
        />
        <KpiCard
          label="Total customers"
          value={snapshot.customerCount}
          icon={Users}
          color={VIZ.amber}
          trend={customersCumulative}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {secondaryStats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-colors hover:border-slate-700">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">{stat.label}</p>
                <stat.icon className={`h-4 w-4 ${stat.alert ? "text-amber-500" : "text-slate-500"}`} />
              </div>
              <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-white">{stat.value}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-sm font-semibold text-white">Performance rings</h2>
        <div className="mt-4 flex flex-wrap justify-around gap-6">
          <RingGauge label="Project completion" pct={completionRatio} goodIsHigh />
          <RingGauge label="Avg. task progress" pct={avgTaskCompletion} goodIsHigh />
          <RingGauge label="Invoice collection rate" pct={collectionRate} goodIsHigh />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-sm font-semibold text-white">Customers by status</h2>
          <ul className="mt-4 space-y-4">
            {customerStatusRows.map((row) => (
              <AllocationBar
                key={row.status}
                label={row.status.charAt(0) + row.status.slice(1).toLowerCase()}
                count={row.count}
                pct={(row.count / totalCustomersForBars) * 100}
                color={customerStatusColor[row.status]}
              />
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-sm font-semibold text-white">Recent activity</h2>
          <div className="mt-4">
            <ActivityTimeline items={timelineItems} />
          </div>
        </div>
      </div>
    </>
  );
}
