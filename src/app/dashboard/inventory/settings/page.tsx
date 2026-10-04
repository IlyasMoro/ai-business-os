import Link from "next/link";
import { db } from "@/lib/db";
import { COST_METHODS } from "@/lib/cost-math";
import { requireRole } from "@/lib/dal";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input, Label, Select } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { SettingToggle } from "@/components/ui-dark/setting-toggle";
import { getInventorySettings } from "@/lib/lots";
import { INVENTORY_PRESETS } from "@/lib/inventory-presets";
import { applyInventoryPreset, updateInventorySettings } from "@/lib/actions/lots";
import { BackButton } from "@/components/ui-dark/back-button";

export default async function InventorySettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { error, saved } = await searchParams;
  const [s, costRow] = await Promise.all([
    getInventorySettings(session.companyId),
    db.inventorySettings.findUnique({ where: { companyId: session.companyId }, select: { costMethod: true } }),
  ]);
  const costMethod = costRow?.costMethod ?? "MANUAL";
  const card = "rounded-2xl border border-white/[0.09] light:border-white/80 glass";

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <BackButton href="/dashboard/inventory" label="Back to inventory" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Inventory settings</h1>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-500">How stock is costed, and how lot and serial tracked stock is picked and watched for expiry.</p>

        <div className="mt-4 space-y-3">
          <ErrorBanner code={error} />
          {saved && <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">Saved.</p>}
        </div>

        <div className={`${card} mt-2 max-w-2xl p-5`}>
          <p className="font-semibold text-slate-50 light:text-slate-900">Start from a template</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Object.entries(INVENTORY_PRESETS).map(([key, preset]) => (
              <form key={key} action={applyInventoryPreset.bind(null, key)} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] light:border-slate-200 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-50 light:text-slate-900">{preset.label}</p>
                  <p className="text-xs text-slate-400 light:text-slate-500">{preset.description}</p>
                </div>
                <SubmitButton variant="secondary" pendingText="Applying...">
                  Apply
                </SubmitButton>
              </form>
            ))}
          </div>
        </div>

        <form action={updateInventorySettings} className={`${card} mt-4 max-w-2xl space-y-5 p-5`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pickingRule">Picking rule</Label>
              <Select id="pickingRule" name="pickingRule" defaultValue={s.pickingRule}>
                <option value="FIFO">First in, first out (oldest receipt)</option>
                <option value="FEFO">First expiring, first out</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="expiryWarningDays">Warn before expiry (days)</Label>
              <Input id="expiryWarningDays" name="expiryWarningDays" type="number" min="0" max="3650" step="1" defaultValue={s.expiryWarningDays} />
            </div>
          </div>
          <SettingToggle name="blockExpired" label="Block expired lots" description="Expired lots are never shipped or used in production." defaultChecked={s.blockExpired} />
          <fieldset className="space-y-2 border-t border-white/[0.06] pt-4 light:border-slate-200">
            <legend className="text-sm font-medium text-slate-200 light:text-slate-800">Product cost when stock is received</legend>
            <p className="text-xs text-slate-500">
              Every received purchase order is also booked in Accounting as a stock purchase. This choice decides whether it updates the
              product&apos;s cost too, which stock value uses.
            </p>
            {COST_METHODS.map((m) => (
              <label key={m.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/[0.06] p-3 light:border-slate-200">
                <input type="radio" name="costMethod" value={m.id} defaultChecked={costMethod === m.id} className="mt-1" />
                <span>
                  <span className="block text-sm font-semibold text-slate-50 light:text-slate-900">{m.label}</span>
                  <span className="block text-xs text-slate-400 light:text-slate-500">{m.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <SubmitButton pendingText="Saving...">Save settings</SubmitButton>
        </form>

      </div>
    </div>
  );
}
