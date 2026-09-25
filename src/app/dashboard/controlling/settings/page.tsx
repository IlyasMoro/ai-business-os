import { requireRole } from "@/lib/dal";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input, Label, Select } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { SettingToggle } from "@/components/ui-dark/setting-toggle";
import { ControllingTabs } from "@/components/controlling/controlling-parts";
import { getControllingSettings } from "@/lib/controlling";
import { CONTROLLING_PRESETS } from "@/lib/controlling-presets";
import { applyControllingPreset, updateControllingSettings } from "@/lib/actions/controlling";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function ControllingSettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { error, saved } = await searchParams;
  const s = await getControllingSettings(session.companyId);
  const card = "rounded-2xl border border-white/[0.09] light:border-white/80 glass";

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Controlling settings</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">How budgets are checked and costs are counted for your business.</p>
      <ControllingTabs active="/dashboard/controlling/settings" />

      <div className="mt-4 max-w-2xl space-y-3">
        <ErrorBanner code={error} />
        {saved && <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">Saved.</p>}
      </div>

      <div className={`${card} mt-2 max-w-2xl p-5`}>
        <p className="font-medium text-slate-50 light:text-slate-900">Start from a template</p>
        <p className="text-sm text-slate-400 light:text-slate-500">Your fiscal year start stays as it is.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(CONTROLLING_PRESETS).map(([key, preset]) => (
            <form key={key} action={applyControllingPreset.bind(null, key)} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] light:border-slate-200 p-3">
              <div>
                <p className="text-sm font-medium text-slate-50 light:text-slate-900">{preset.label}</p>
                <p className="text-xs text-slate-400 light:text-slate-500">{preset.description}</p>
              </div>
              <SubmitButton variant="secondary" pendingText="Applying...">
                Apply
              </SubmitButton>
            </form>
          ))}
        </div>
      </div>

      <form action={updateControllingSettings} className={`${card} mt-4 max-w-2xl space-y-5 p-5`}>
        <SettingToggle name="enabled" label="Use Controlling" description="Turn this off if you don't budget by department. The Controlling page is hidden while it's off." defaultChecked={s.enabled} />
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="fiscalYearStartMonth">Fiscal year starts</Label>
            <Select id="fiscalYearStartMonth" name="fiscalYearStartMonth" defaultValue={s.fiscalYearStartMonth}>
              {MONTHS.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="overBudgetAction">When an expense goes over budget</Label>
            <Select id="overBudgetAction" name="overBudgetAction" defaultValue={s.overBudgetAction}>
              <option value="NONE">Do nothing</option>
              <option value="WARN">Save and warn</option>
              <option value="BLOCK">Block it</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="tolerancePercent">Tolerance (%)</Label>
            <Input id="tolerancePercent" name="tolerancePercent" type="number" min="0" max="100" step="0.5" defaultValue={s.tolerancePercent} />
            <p className="mt-1 text-xs text-slate-500">How far over budget is still fine.</p>
          </div>
        </div>
        <SettingToggle name="includePayroll" label="Count payroll" description="Paid payroll counts as cost on each employee's cost center." defaultChecked={s.includePayroll} />
        <SettingToggle name="requireCostCenter" label="Require a cost object on expenses" description="Every new expense must name a cost center or internal order." defaultChecked={s.requireCostCenter} />
        <SubmitButton pendingText="Saving...">Save settings</SubmitButton>
      </form>
    </div>
  );
}
