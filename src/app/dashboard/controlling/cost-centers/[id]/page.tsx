import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { GroupedBarChart } from "@/components/dash-viz/grouped-bar-chart";
import { Badge } from "@/components/ui-dark/badge";
import { Input, Label } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { SettingToggle } from "@/components/ui-dark/setting-toggle";
import { ErrorBanner } from "@/components/ui/error-banner";
import { UsageBar, VarianceBadge, money } from "@/components/controlling/controlling-parts";
import { getControllingSettings, loadCostLines } from "@/lib/controlling";
import { fiscalYearLabel, fiscalYearMonths, monthLabel, periodKey, periodOf, periodRange, resolvePeriods, variance } from "@/lib/controlling-math";
import { deleteCostCenter, saveBudgets, updateCostCenter } from "@/lib/actions/controlling";

const SOURCE_LABEL = { EXPENSE: "Expense", PAYROLL: "Payroll", ALLOCATION: "Allocation", SETTLEMENT: "Settlement" } as const;

export default async function CostCenterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fy?: string; error?: string; saved?: string }>;
}) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { id } = await params;
  const { fy, error, saved } = await searchParams;
  const settings = await getControllingSettings(session.companyId);

  const cc = await db.costCenter.findUnique({
    where: { id, companyId: session.companyId },
    include: { employees: { where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } } },
  });
  if (!cc) notFound();

  const period = resolvePeriods(fy, undefined, settings.fiscalYearStartMonth);
  const months = fiscalYearMonths(period.fiscalYear, settings.fiscalYearStartMonth);
  const [budgets, lines] = await Promise.all([
    db.costBudget.findMany({ where: { costCenterId: cc.id, OR: months.map((p) => ({ year: p.year, month: p.month })) } }),
    loadCostLines(session.companyId, periodRange(months), settings, { costCenterId: cc.id }),
  ]);
  const own = lines.filter((l) => l.costCenterId === cc.id);
  const monthly = months.map((p) => {
    const key = periodKey(p);
    return {
      p,
      key,
      plan: budgets.find((b) => b.year === p.year && b.month === p.month)?.amount ?? 0,
      actual: own.filter((l) => periodKey(periodOf(l.date)) === key).reduce((s, l) => s + l.amount, 0),
    };
  });
  const plan = monthly.reduce((s, x) => s + x.plan, 0);
  const actual = monthly.reduce((s, x) => s + x.actual, 0);
  const v = variance(plan, actual, settings.tolerancePercent);
  const card = "rounded-2xl border border-white/[0.09] light:border-white/80 glass";

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">
                <span className="font-mono">{cc.code}</span> {cc.name}
              </h1>
              {!cc.active && <Badge tone="slate">Inactive</Badge>}
              <VarianceBadge status={v.status} />
            </div>
            <p className="mt-1 text-slate-400 light:text-slate-500">
              {fiscalYearLabel(period.fiscalYear, settings.fiscalYearStartMonth)}: plan {money(plan)}, actual {money(actual)}, variance{" "}
              <span className={v.variance > 0 ? "text-red-400" : "text-emerald-400"}>{money(v.variance)}</span>
            </p>
          </div>
          <form method="GET" className="flex items-center gap-2">
            <select name="fy" defaultValue={period.fiscalYear} className="rounded-md border border-white/[0.09] light:border-white/80 px-3 py-2 text-sm text-slate-50 light:text-slate-900 glass">
              {period.years.map((y) => (
                <option key={y} value={y}>
                  {fiscalYearLabel(y, settings.fiscalYearStartMonth)}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-md border border-white/[0.06] light:border-slate-200 px-3 py-2 text-sm text-slate-300">
              Show
            </button>
          </form>
        </div>

        <div className="mt-4 space-y-3">
          <ErrorBanner code={error} />
          {saved && <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">Saved.</p>}
        </div>

        <div className={`${card} mt-4 p-6`}>
          <h2 className="mb-4 text-sm font-semibold text-slate-50 light:text-slate-900">Plan vs actual by month</h2>
          <GroupedBarChart data={monthly.map((x) => ({ label: monthLabel(x.p).slice(0, 3), a: x.plan, b: x.actual }))} aLabel="Plan" bLabel="Actual" />
        </div>

        <form action={saveBudgets.bind(null, cc.id, period.fiscalYear)} className={`${card} mt-6 p-5`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-medium text-slate-50 light:text-slate-900">Budget</p>
              <p className="text-sm text-slate-400 light:text-slate-500">Planned cost per month. Leave a month empty for no budget.</p>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <Label htmlFor="fillAll">Same every month</Label>
                <Input id="fillAll" name="fillAll" type="number" min="0" step="0.01" placeholder="Optional" className="w-36" />
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {monthly.map((x) => {
              const mv = variance(x.plan, x.actual, settings.tolerancePercent);
              return (
                <div key={x.key}>
                  <Label htmlFor={`m${x.key}`}>{monthLabel(x.p)}</Label>
                  <Input id={`m${x.key}`} name={`m${x.key}`} type="number" min="0" step="0.01" defaultValue={x.plan || ""} className="font-mono" />
                  <p className={`mt-1 font-mono text-xs tabular-nums ${mv.status === "OVER" ? "text-red-400" : "text-slate-500"}`}>Actual {money(x.actual)}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-4">
            <SubmitButton pendingText="Saving...">Save budget</SubmitButton>
            <UsageBar used={v.used} status={v.status} />
          </div>
        </form>

        <div className={`${card} mt-6 overflow-x-auto`}>
          <h2 className="px-5 pt-4 text-sm font-semibold text-slate-50 light:text-slate-900">Line items ({own.length})</h2>
          {own.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No costs in this fiscal year yet. Assign expenses to this cost center in Accounting, or employees in HR.</p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <tbody>
                {own.map((l, i) => (
                  <tr key={i} className="border-t border-white/[0.04] light:border-slate-100">
                    <td className="px-5 py-2 text-slate-400">{l.date.toLocaleDateString()}</td>
                    <td className="px-5 py-2">
                      <Badge tone={l.source === "EXPENSE" ? "slate" : l.source === "PAYROLL" ? "purple" : "blue"}>{SOURCE_LABEL[l.source]}</Badge>
                    </td>
                    <td className="px-5 py-2 text-slate-300 light:text-slate-600">
                      {l.href ? (
                        <Link href={l.href} className="hover:text-blue-400">
                          {l.label}
                        </Link>
                      ) : (
                        l.label
                      )}
                    </td>
                    <td className={`px-5 py-2 text-right font-mono tabular-nums ${l.amount < 0 ? "text-emerald-400" : "text-slate-300 light:text-slate-600"}`}>{money(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <form action={updateCostCenter.bind(null, cc.id)} className={`${card} space-y-4 p-5`}>
            <p className="font-medium text-slate-50 light:text-slate-900">Details</p>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={cc.name} required maxLength={100} />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" defaultValue={cc.description ?? ""} maxLength={500} />
            </div>
            <SettingToggle name="active" label="Active" description="Inactive cost centers can't take new expenses." defaultChecked={cc.active} />
            <SubmitButton variant="secondary" pendingText="Saving...">
              Save
            </SubmitButton>
          </form>
          <div className={`${card} p-5`}>
            <p className="font-medium text-slate-50 light:text-slate-900">People ({cc.employees.length})</p>
            {cc.employees.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No active employees. Set the cost center on an employee in HR.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {cc.employees.map((e) => (
                  <li key={e.id}>
                    <Link href={`/dashboard/hr/${e.id}`} className="text-slate-300 hover:text-blue-400 light:text-slate-600">
                      {e.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <DeleteButton action={deleteCostCenter.bind(null, cc.id)} confirmMessage={`Delete cost center ${cc.code}?`} />
        </div>

        <p className="mt-6">
          <Link href="/dashboard/controlling/cost-centers" className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
            ← Back to cost centers
          </Link>
        </p>
      </div>
    </div>
  );
}
