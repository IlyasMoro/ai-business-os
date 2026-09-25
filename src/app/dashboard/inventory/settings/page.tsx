import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input, Label, Select } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { SettingToggle } from "@/components/ui-dark/setting-toggle";
import { getInventorySettings } from "@/lib/lots";
import { INVENTORY_PRESETS } from "@/lib/inventory-presets";
import { applyInventoryPreset, updateInventorySettings } from "@/lib/actions/lots";

export default async function InventorySettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { error, saved } = await searchParams;
  const s = await getInventorySettings(session.companyId);
  const card = "rounded-2xl border border-white/[0.09] light:border-white/80 glass";

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Inventory settings</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">How lot and serial tracked stock is picked and watched for expiry.</p>

      <div className="mt-4 max-w-2xl space-y-3">
        <ErrorBanner code={error} />
        {saved && <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">Saved.</p>}
      </div>

      <div className={`${card} mt-2 max-w-2xl p-5`}>
        <p className="font-medium text-slate-50 light:text-slate-900">Start from a template</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(INVENTORY_PRESETS).map(([key, preset]) => (
            <form key={key} action={applyInventoryPreset.bind(null, key)} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] light:border-slate-200 p-3">
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
        <SubmitButton pendingText="Saving...">Save settings</SubmitButton>
      </form>

      <p className="mt-6">
        <Link href="/dashboard/inventory" className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
          ← Back to inventory
        </Link>
      </p>
    </div>
  );
}
