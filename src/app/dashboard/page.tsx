import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { getAgendaItems } from "@/lib/agenda";
import { ErrorBanner } from "@/components/ui/error-banner";
import { KpiCard, type KpiChange } from "@/components/dash-viz/kpi-card";
import { RingGauge } from "@/components/dash-viz/ring-gauge";
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
  TrendingDown,
  TrendingUp,
  Megaphone,
  Truck,
  UserSquare2,
  CalendarClock,
  FileText,
  CheckSquare,
  Banknote,
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

/** Percentage change vs. the previous period. Null (rendered as "New")
 * when the previous period was zero, since a percentage would be
 * meaningless (division by zero) rather than actually informative. */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function daysLeft(date: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

const AGENDA_ICON = {
  event: CalendarClock,
  invoice: FileText,
  task: CheckSquare,
  project: FolderKanban,
  payroll: Banknote,
} as const;

function WidgetsSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white" />
        ))}
      </div>
      <div className="mt-6 h-64 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="h-64 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white" />
        <div className="h-64 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white" />
        <div className="h-64 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white" />
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
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <ErrorBanner code={error} />

      <div>
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">
          Welcome back, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-slate-400 light:text-slate-500">
          Here&apos;s what&apos;s happening at {user.company.name}.
        </p>
      </div>

      <Suspense fallback={<WidgetsSkeleton />}>
        <DashboardWidgets companyId={user.companyId} />
      </Suspense>
    </div>
  );
}

async function DashboardWidgets({ companyId }: { companyId: string }) {
  const now = new Date();
  const sixMonthsAgo = startOfMonth(subMonths(now, 5));
  const months = monthBuckets(6);
  const currentMonthStart = startOfMonth(now);
  const previousMonthStart = startOfMonth(subMonths(now, 1));
  const previousMonthEnd = endOfMonth(subMonths(now, 1));
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    customerCount,
    openOrderCount,
    products,
    outstandingInvoiceCount,
    openTicketCount,
    openPurchaseOrderCount,
    employeeCount,
    activeCampaignCount,
    incomeTx,
    expenseTx,
    projectsForTrend,
    customersForTrend,
    campaignsForTrend,
    projectStatusGroups,
    taskStatusGroups,
    invoiceStatusGroups,
    customerStatusGroups,
    recentAiActions,
    recentAuditLogs,
    subscription,
    agendaItems,
  ] = await Promise.all([
    db.customer.count({ where: { companyId } }),
    db.order.count({ where: { companyId, status: { in: ["PENDING", "CONFIRMED"] } } }),
    db.product.findMany({ where: { companyId }, select: { stockQty: true, reorderLevel: true } }),
    db.invoice.count({ where: { companyId, status: { in: ["SENT", "OVERDUE"] } } }),
    db.ticket.count({ where: { companyId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.purchaseOrder.count({ where: { companyId, status: { in: ["DRAFT", "ORDERED"] } } }),
    db.employee.count({ where: { companyId, status: "ACTIVE" } }),
    db.campaign.count({ where: { companyId, status: "ACTIVE" } }),
    db.transaction.findMany({
      where: { companyId, type: "INCOME", date: { gte: sixMonthsAgo } },
      select: { amount: true, date: true },
    }),
    db.transaction.findMany({
      where: { companyId, type: "EXPENSE", date: { gte: sixMonthsAgo } },
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
    db.campaign.findMany({
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
    db.subscription.findUnique({ where: { companyId } }),
    getAgendaItems(companyId),
  ]);

  const lowStockCount = products.filter((p) => p.stockQty <= p.reorderLevel).length;
  const projectStatusMap = new Map(projectStatusGroups.map((g) => [g.status, g._count._all]));
  const activeCount = projectStatusMap.get("ACTIVE") ?? 0;
  const completedCount = projectStatusMap.get("COMPLETED") ?? 0;
  const onHoldCount = projectStatusMap.get("ON_HOLD") ?? 0;
  const totalProjects = activeCount + completedCount + onHoldCount;
  const completionRatio = totalProjects > 0 ? (completedCount / totalProjects) * 100 : 0;

  const snapshot = { customerCount, openOrderCount, lowStockCount, outstandingInvoiceCount, openTicketCount, activeProjectCount: activeCount };

  // ---- Financials: revenue, expenses, net profit, each with a 6 month
  // trend and a this-month-vs-last-month percentage change. ----
  const totalRevenue = incomeTx.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenseTx.reduce((s, t) => s + t.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  const revenueTrend = months.map((m) =>
    incomeTx.filter((t) => t.date >= m && t.date <= endOfMonth(m)).reduce((s, t) => s + t.amount, 0)
  );
  const expenseTrend = months.map((m) =>
    expenseTx.filter((t) => t.date >= m && t.date <= endOfMonth(m)).reduce((s, t) => s + t.amount, 0)
  );
  const profitTrend = revenueTrend.map((rev, i) => rev - expenseTrend[i]);

  const revenueThisMonth = incomeTx.filter((t) => t.date >= currentMonthStart).reduce((s, t) => s + t.amount, 0);
  const revenueLastMonth = incomeTx
    .filter((t) => t.date >= previousMonthStart && t.date <= previousMonthEnd)
    .reduce((s, t) => s + t.amount, 0);
  const expensesThisMonth = expenseTx.filter((t) => t.date >= currentMonthStart).reduce((s, t) => s + t.amount, 0);
  const expensesLastMonth = expenseTx
    .filter((t) => t.date >= previousMonthStart && t.date <= previousMonthEnd)
    .reduce((s, t) => s + t.amount, 0);

  const revenueChange: KpiChange = { pct: pctChange(revenueThisMonth, revenueLastMonth), label: "vs last month" };
  const expensesChange: KpiChange = {
    pct: pctChange(expensesThisMonth, expensesLastMonth),
    label: "vs last month",
    goodIsUp: false,
  };
  const profitChange: KpiChange = {
    pct: pctChange(revenueThisMonth - expensesThisMonth, revenueLastMonth - expensesLastMonth),
    label: "vs last month",
  };

  // ---- Growth: active projects, total customers, active campaigns —
  // counts are cumulative totals, so "change" compares how many were
  // newly added this month vs last month, rather than the total itself
  // (which almost never shrinks and would make the badge meaningless). ----
  const projectsPerMonth = months.map(
    (m) => projectsForTrend.filter((p) => p.createdAt >= m && p.createdAt <= endOfMonth(m)).length
  );
  const projectsCumulative = runningTotals(projectsPerMonth, snapshot.activeProjectCount - projectsForTrend.length);
  const newProjectsThisMonth = projectsForTrend.filter((p) => p.createdAt >= currentMonthStart).length;
  const newProjectsLastMonth = projectsForTrend.filter(
    (p) => p.createdAt >= previousMonthStart && p.createdAt <= previousMonthEnd
  ).length;

  const customersPerMonth = months.map(
    (m) => customersForTrend.filter((c) => c.createdAt >= m && c.createdAt <= endOfMonth(m)).length
  );
  const customersCumulative = runningTotals(customersPerMonth, snapshot.customerCount - customersForTrend.length);
  const newCustomersThisMonth = customersForTrend.filter((c) => c.createdAt >= currentMonthStart).length;
  const newCustomersLastMonth = customersForTrend.filter(
    (c) => c.createdAt >= previousMonthStart && c.createdAt <= previousMonthEnd
  ).length;

  const campaignsPerMonth = months.map(
    (m) => campaignsForTrend.filter((c) => c.createdAt >= m && c.createdAt <= endOfMonth(m)).length
  );
  const campaignsCumulative = runningTotals(campaignsPerMonth, activeCampaignCount - campaignsForTrend.length);
  const newCampaignsThisMonth = campaignsForTrend.filter((c) => c.createdAt >= currentMonthStart).length;
  const newCampaignsLastMonth = campaignsForTrend.filter(
    (c) => c.createdAt >= previousMonthStart && c.createdAt <= previousMonthEnd
  ).length;

  const projectsChange: KpiChange = {
    pct: pctChange(newProjectsThisMonth, newProjectsLastMonth),
    label: "new vs last month",
  };
  const customersChange: KpiChange = {
    pct: pctChange(newCustomersThisMonth, newCustomersLastMonth),
    label: "new vs last month",
  };
  const campaignsChange: KpiChange = {
    pct: pctChange(newCampaignsThisMonth, newCampaignsLastMonth),
    label: "new vs last month",
  };

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

  const upcomingItems = agendaItems.filter((item) => item.date <= sevenDaysFromNow).slice(0, 6);

  const secondaryStats = [
    { label: "Open orders", value: snapshot.openOrderCount, href: "/dashboard/sales", icon: ShoppingCart, alert: false },
    { label: "Low stock", value: snapshot.lowStockCount, href: "/dashboard/inventory", icon: Boxes, alert: snapshot.lowStockCount > 0 },
    { label: "Outstanding invoices", value: snapshot.outstandingInvoiceCount, href: "/dashboard/invoicing", icon: Receipt, alert: snapshot.outstandingInvoiceCount > 0 },
    { label: "Open tickets", value: snapshot.openTicketCount, href: "/dashboard/support", icon: LifeBuoy, alert: snapshot.openTicketCount > 0 },
    { label: "Open purchase orders", value: openPurchaseOrderCount, href: "/dashboard/procurement", icon: Truck, alert: false },
    { label: "Employees", value: employeeCount, href: "/dashboard/hr", icon: UserSquare2, alert: false },
  ];

  const isTrialing =
    subscription?.status === "TRIALING" && (!subscription.trialEndsAt || subscription.trialEndsAt > new Date());

  return (
    <>
      {isTrialing && subscription?.trialEndsAt && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <span>
            {daysLeft(subscription.trialEndsAt)} day{daysLeft(subscription.trialEndsAt) === 1 ? "" : "s"} left in
            your trial.
          </span>
          <Link href="/dashboard/billing" className="font-medium underline hover:text-amber-200">
            Manage billing
          </Link>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Revenue (6 months)"
          value={totalRevenue}
          prefix="$"
          decimals={0}
          icon={Wallet}
          color={VIZ.emerald}
          trend={revenueTrend}
          change={revenueChange}
        />
        <KpiCard
          label="Expenses (6 months)"
          value={totalExpenses}
          prefix="$"
          decimals={0}
          icon={TrendingDown}
          color={VIZ.red}
          trend={expenseTrend}
          change={expensesChange}
        />
        <KpiCard
          label="Net profit (6 months)"
          value={netProfit}
          prefix="$"
          decimals={0}
          icon={TrendingUp}
          color={VIZ.blue}
          trend={profitTrend}
          change={profitChange}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Active projects"
          value={activeCount}
          icon={FolderKanban}
          color={VIZ.blue}
          trend={projectsCumulative}
          change={projectsChange}
        />
        <KpiCard
          label="Total customers"
          value={snapshot.customerCount}
          icon={Users}
          color={VIZ.amber}
          trend={customersCumulative}
          change={customersChange}
        />
        <KpiCard
          label="Active campaigns"
          value={activeCampaignCount}
          icon={Megaphone}
          color={VIZ.emerald}
          trend={campaignsCumulative}
          change={campaignsChange}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {secondaryStats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <div className="rounded-xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-4 transition-colors hover:border-slate-700">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400 light:text-slate-500">{stat.label}</p>
                <stat.icon className={`h-4 w-4 ${stat.alert ? "text-amber-500" : "text-slate-500"}`} />
              </div>
              <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-slate-50 light:text-slate-900">{stat.value}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-50 light:text-slate-900">Performance rings</h2>
        <div className="mt-4 flex flex-wrap justify-around gap-6">
          <RingGauge label="Project completion" pct={completionRatio} goodIsHigh />
          <RingGauge label="Avg. task progress" pct={avgTaskCompletion} goodIsHigh />
          <RingGauge label="Invoice collection rate" pct={collectionRate} goodIsHigh />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-50 light:text-slate-900">Customers by status</h2>
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

        <div className="rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-50 light:text-slate-900">Upcoming this week</h2>
          {upcomingItems.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Nothing due in the next 7 days.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {upcomingItems.map((item) => {
                const Icon = AGENDA_ICON[item.kind];
                const overdue = item.date < now;
                const content = (
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 shrink-0 ${overdue ? "text-red-400" : "text-slate-500"}`} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-50 light:text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">
                        {overdue ? "Overdue · " : ""}
                        {item.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    {item.href ? (
                      <Link href={item.href} className="block transition-colors hover:opacity-80">
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-50 light:text-slate-900">Recent activity</h2>
          <div className="mt-4">
            <ActivityTimeline items={timelineItems} />
          </div>
        </div>
      </div>
    </>
  );
}
