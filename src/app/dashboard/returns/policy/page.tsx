import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { ErrorBanner } from "@/components/ui/error-banner";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { ReturnPolicyForm } from "@/components/returns/return-policy-form";
import { getReturnPolicy } from "@/lib/returns-policy";
import { RETURN_POLICY_PRESETS } from "@/lib/returns-policy-presets";
import { applyReturnPolicyPreset } from "@/lib/actions/returns";

export default async function ReturnPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { error, saved } = await searchParams;
  const policy = await getReturnPolicy(session.companyId);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Return policy</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        Decide how returns work for your business. Changes apply to new returns only.
      </p>

      <div className="mt-4 max-w-2xl space-y-3">
        <ErrorBanner code={error} />
        {saved && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            Saved.
          </div>
        )}
      </div>

      <div className="mt-6 max-w-2xl rounded-2xl border border-white/[0.09] light:border-white/80 p-5 glass">
        <p className="font-medium text-slate-50 light:text-slate-900">Start from a template</p>
        <p className="text-sm text-slate-400 light:text-slate-500">
          Pick the one closest to your business, then fine tune it below.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(RETURN_POLICY_PRESETS).map(([key, preset]) => (
            <form
              key={key}
              action={applyReturnPolicyPreset.bind(null, key)}
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

      <div className="mt-4 max-w-2xl rounded-2xl border border-white/[0.09] light:border-white/80 p-5 glass">
        <ReturnPolicyForm policy={policy} />
      </div>

      <p className="mt-6">
        <Link href="/dashboard/returns" className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
          ← Back to returns
        </Link>
      </p>
    </div>
  );
}
