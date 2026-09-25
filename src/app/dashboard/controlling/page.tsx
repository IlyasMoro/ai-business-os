import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { GroupedBarChart } from "@/components/dash-viz/grouped-bar-chart";
import { StatusBadge } from "@/components/ui-dark/badge";
import { ControllingTabs, PeriodPicker, UsageBar, VarianceBadge, money } from "@/components/controlling/controlling-parts";
import { costCenterPlanActual, getControllingSettings, sumBy, loadCostLines } from "@/lib/controlling";
import { fiscalYearMonths, monthLabel, periodKey, periodOf, resolvePeriods, variance } from "@/lib/controlling-math";
import { TriangleAlert } from "lucide-react";

const orderTone = { OPEN: "blue", CLOSED: "yellow", SETTLED: "green" } as const;

export default async function ControllingPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string; m?: string }>;
}) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { fy, m } = await searchParams;
  const settings = await getControllingSettings(session.companyId);

  if (!settings.enabled) {
    return (
      <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Controlling</h1>
        <p className="mt-4 max-w-2xl rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Controlling is turned off.{" "}
          <Link href="/dashboard/controlling/settings" className="underline">
            Turn it on in the settings
          </Link>
        </p>
      </div>
    );
  }

  const period = resolvePeriods(fy, m, settings.fiscalYearStartMonth);
  const tol = settings.tolerancePercent;
  const { rows, lines, budgets } = await costCenterPlanActual(session.companyId, settings, period.periods);

  // Monthly totals for the whole fiscal year drive the chart, whatever month is picked.
  const yearMonths = fiscalYearMonths(period.fiscalYear, settings.fiscalYearStartMonth);
  const yearData = period.month ? await costCenterPlanActual(session.companyId, settings, yearMonths) : { lines, budgets };
  const chart = yearMonths.map((p) => ({
    label: monthLabel(p).slice(0, 3),
    a: yearData.budgets.filter((b) => b.year === p.year && b.month === p.month).reduce((s, b) => s + b.amount, 0),
    b: yearData.lines
      .filter((l) => l.costCenterId && periodKey(periodOf(l.date)) === periodKey(p))
      .reduce((s, l) => s + l.amount, 0),
  }));

  const orders = await db.internalOrder.findMany({
    where: { companyId: session.companyId, status: { not: "SETTLED" } },
    select: { id: true, orderNumber: true, name: true, budget: true, status: true },
    orderBy: { orderNumber: "asc" },
  });
  const orderLines = await loadCostLines(
    session.companyId,
    { from: new Date(Date.UTC(1970, 0, 1)), to: new Date(Date.UTC(9999, 0, 1)) },
    // Orders never carry payroll, so skip loading it here.
    { ...settings, includePayroll: false }
  );
  const orderActual = sumBy(orderLines, "internalOrderId");

  const shown = rows.filter((r) => r.active || r.plan > 0 || r.actual > 0);
  const totalPlan = shown.reduce((s, r) => s + r.plan, 0);
  const totalActual = shown.reduce((s, r) => s + r.actual, 0);
  const totals = variance(totalPlan, totalActual, tol);
  const over = [
    ...shown.filter((r) => variance(r.plan, r.actual, tol).status === "OVER").map((r) => ({ href: `/dashboard/controlling/cost-centers/${r.id}`, label: `${r.code} ${r.name}`, by: r.actual - r.plan })),
    ...orders
      .filter((o) => variance(o.budget, orderActual.get(o.id) ?? 0, tol).status === "OVER")
      .map((o) => ({ href: `/dashboard/controlling/orders/${o.id}`, label: `${o.orderNumber} ${o.name}`, by: (orderActual.get(o.id) ?? 0) - o.budget })),
  ];

  const card = "rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white";
  const periodName = period.month ? monthLabel(period.periods[0]) : "the whole year";

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Controlling</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            Plan vs actual for {periodName}. Over budget expenses are{" "}
            {settings.overBudgetAction === "BLOCK" ? "blocked" : settings.overBudgetAction === "WARN" ? "flagged" : "not checked"}
            {tol > 0 && settings.overBudgetAction !== "NONE" ? ` beyond a ${tol}% tolerance` : ""}.
          </p>
        </div>
        <PeriodPicker action="/dashboard/controlling" fiscalYear={period.fiscalYear} month={period.month} startMonth={settings.fiscalYearStartMonth} years={period.years} />
      </div>
      <ControllingTabs active="/dashboard/controlling" />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: "Plan", value: money(totalPlan), cls: "text-blue-400" },
          { label: "Actual", value: money(totalActual), cls: "text-amber-400" },
          { label: "Variance", value: money(totals.variance), cls: totals.variance > 0 ? "text-red-400" : "text-emerald-400" },
          { label: "Over budget", value: String(over.length), cls: over.length > 0 ? "text-red-400" : "text-emerald-400" },
        ].map((k) => (
          <div key={k.label} className={`${card} p-5`}>
            <p className="text-sm text-slate-400 light:text-slate-500">{k.label}</p>
            <p className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {over.length > 0 && (
        <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert className="h-4 w-4" /> Over budget
          </p>
          <ul className="mt-1 space-y-0.5">
            {over.map((o) => (
              <li key={o.href}>
                <Link href={o.href} className="underline hover:text-red-200">
                  {o.label}
                </Link>{" "}
                by {money(o.by)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={`${card} mt-6 p-6`}>
        <h2 className="mb-4 text-sm font-semibold text-slate-50 light:text-slate-900">Cost center plan vs actual by month</h2>
        <GroupedBarChart data={chart} aLabel="Plan" bLabel="Actual" />
      </div>

      <div className={`${card} mt-6 overflow-x-auto`}>
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-sm font-semibold text-slate-50 light:text-slate-900">Cost centers</h2>
          <Link href="/dashboard/controlling/cost-centers" className="text-sm text-blue-400 hover:text-blue-300">
            Manage
          </Link>
        </div>
        {shown.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No cost centers yet.{" "}
            <Link href="/dashboard/controlling/cost-centers" className="text-blue-400">
              Create the first one
            </Link>
            .
          </p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Cost center</th>
                <th className="px-5 py-3 text-right font-medium">Plan</th>
                <th className="px-5 py-3 text-right font-medium">Actual</th>
                <th className="px-5 py-3 text-right font-medium">Variance</th>
                <th className="px-5 py-3 font-medium">Used</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const v = variance(r.plan, r.actual, tol);
                return (
                  <tr key={r.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/controlling/cost-centers/${r.id}?fy=${period.fiscalYear}`} className="font-medium text-slate-50 light:text-slate-900 hover:text-blue-400">
                        <span className="font-mono">{r.code}</span> {r.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-300 light:text-slate-600">{money(r.plan)}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-300 light:text-slate-600">{money(r.actual)}</td>
                    <td className={`px-5 py-3 text-right font-mono tabular-nums ${v.variance > 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {money(v.variance)}
                      {v.variancePercent !== null && <span className="ml-1 text-xs text-slate-500">({v.variancePercent}%)</span>}
                    </td>
                    <td className="px-5 py-3">
                      <UsageBar used={v.used} status={v.status} />
                    </td>
                    <td className="px-5 py-3">
                      <VarianceBadge status={v.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className={`${card} mt-6 overflow-x-auto`}>
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-sm font-semibold text-slate-50 light:text-slate-900">Open internal orders</h2>
          <Link href="/dashboard/controlling/orders" className="text-sm text-blue-400 hover:text-blue-300">
            Manage
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No open internal orders.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Budget</th>
                <th className="px-5 py-3 text-right font-medium">Actual</th>
                <th className="px-5 py-3 text-right font-medium">Available</th>
                <th className="px-5 py-3 font-medium">Used</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const actual = orderActual.get(o.id) ?? 0;
                const v = variance(o.budget, actual, tol);
                return (
                  <tr key={o.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/controlling/orders/${o.id}`} className="font-medium text-slate-50 light:text-slate-900 hover:text-blue-400">
                        <span className="font-mono">{o.orderNumber}</span> {o.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={o.status} tone={orderTone[o.status]} />
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-300 light:text-slate-600">{money(o.budget)}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-300 light:text-slate-600">{money(actual)}</td>
                    <td className={`px-5 py-3 text-right font-mono tabular-nums ${o.budget - actual < 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {o.budget > 0 ? money(o.budget - actual) : ""}
                    </td>
                    <td className="px-5 py-3">
                      <UsageBar used={v.used} status={v.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
