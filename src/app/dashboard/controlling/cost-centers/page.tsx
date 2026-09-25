import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui-dark/badge";
import { Input, Label } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ControllingTabs, PeriodPicker, UsageBar, VarianceBadge, money } from "@/components/controlling/controlling-parts";
import { costCenterPlanActual, getControllingSettings } from "@/lib/controlling";
import { resolvePeriods, variance } from "@/lib/controlling-math";
import { createCostCenter } from "@/lib/actions/controlling";

export default async function CostCentersPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string; m?: string; error?: string }>;
}) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { fy, m, error } = await searchParams;
  const settings = await getControllingSettings(session.companyId);
  const period = resolvePeriods(fy, m, settings.fiscalYearStartMonth);
  const [{ rows }, headcount] = await Promise.all([
    costCenterPlanActual(session.companyId, settings, period.periods),
    db.employee.groupBy({ by: ["costCenterId"], where: { companyId: session.companyId, status: "ACTIVE", costCenterId: { not: null } }, _count: { _all: true } }),
  ]);
  const heads = new Map(headcount.map((h) => [h.costCenterId, h._count._all]));

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Cost centers</h1>
        <PeriodPicker action="/dashboard/controlling/cost-centers" fiscalYear={period.fiscalYear} month={period.month} startMonth={settings.fiscalYearStartMonth} years={period.years} />
      </div>
      <ControllingTabs active="/dashboard/controlling/cost-centers" />

      <div className="mt-4">
        <ErrorBanner code={error} />
      </div>

      <div className="mt-2 overflow-x-auto rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No cost centers yet. A common start is one per department, like 1000 Administration, 2000 Sales, 3000 Production.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 text-right font-medium">People</th>
                <th className="px-5 py-3 text-right font-medium">Plan</th>
                <th className="px-5 py-3 text-right font-medium">Actual</th>
                <th className="px-5 py-3 font-medium">Used</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const v = variance(r.plan, r.actual, settings.tolerancePercent);
                return (
                  <tr key={r.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-5 py-3 font-mono text-slate-300 light:text-slate-600">{r.code}</td>
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/controlling/cost-centers/${r.id}?fy=${period.fiscalYear}`} className="font-medium text-slate-50 light:text-slate-900 hover:text-blue-400">
                        {r.name}
                      </Link>
                      {!r.active && <Badge tone="slate" className="ml-2">Inactive</Badge>}
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-400">{heads.get(r.id) ?? 0}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-300 light:text-slate-600">{money(r.plan)}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-300 light:text-slate-600">{money(r.actual)}</td>
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

      <form
        action={createCostCenter}
        className="mt-6 max-w-2xl space-y-4 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5"
      >
        <p className="font-medium text-slate-50 light:text-slate-900">New cost center</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" placeholder="1000" maxLength={10} required className="font-mono" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Administration" maxLength={100} required />
          </div>
        </div>
        <div>
          <Label htmlFor="description">Description (optional)</Label>
          <Input id="description" name="description" maxLength={500} />
        </div>
        <SubmitButton pendingText="Creating...">Create cost center</SubmitButton>
      </form>
    </div>
  );
}
