import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { ErrorBanner } from "@/components/ui/error-banner";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { SettingToggle } from "@/components/ui-dark/setting-toggle";
import { getMrpSettings } from "@/lib/mrp";
import { MRP_PRESETS } from "@/lib/mrp-settings-presets";
import { applyMrpPreset, updateMrpSettings } from "@/lib/actions/mrp";

export default async function PlanningSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { error, saved } = await searchParams;
  const settings = await getMrpSettings(session.companyId);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Planning settings</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        Decide how material planning works for your business.
      </p>

      <div className="mt-4 max-w-2xl space-y-3">
        <ErrorBanner code={error} />
        {saved && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            Saved.
          </div>
        )}
      </div>

      <div className="mt-6 max-w-2xl rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
        <p className="font-medium text-slate-50 light:text-slate-900">Start from a template</p>
        <p className="text-sm text-slate-400 light:text-slate-500">
          Pick the one closest to how you work, then fine tune it below.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(MRP_PRESETS).map(([key, preset]) => (
            <form
              key={key}
              action={applyMrpPreset.bind(null, key)}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] light:border-slate-200 p-3"
            >
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

      <form
        action={updateMrpSettings}
        className="mt-4 max-w-2xl space-y-5 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5"
      >
        <SettingToggle
          name="enabled"
          label="Use planning"
          description="Turn this off if you don't hold stock. The Planning page is hidden while it's off."
          defaultChecked={settings.enabled}
        />
        <SettingToggle
          name="includePendingOrders"
          label="Count pending orders as demand"
          description="When off, only confirmed sales orders drive the plan."
          defaultChecked={settings.includePendingOrders}
        />
        <SettingToggle
          name="useSafetyStock"
          label="Keep safety stock"
          description="Treat each product's reorder level as a minimum to keep on hand."
          defaultChecked={settings.useSafetyStock}
        />
        <SettingToggle
          name="allowNegativeStock"
          label="Allow short completions"
          description="Let a work order complete even when components are short. Stock can go below zero until it's corrected."
          defaultChecked={settings.allowNegativeStock}
        />
        <SubmitButton pendingText="Saving...">Save settings</SubmitButton>
      </form>

      <p className="mt-6">
        <Link href="/dashboard/mrp" className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
          ← Back to planning
        </Link>
      </p>
    </div>
  );
}
