import { Lock } from "lucide-react";
import { LinkButton } from "@/components/ui-dark/button";
import { getCurrentUser } from "@/lib/dal";
import { getCompanyPlan } from "@/lib/plan-limits";
import { FEATURE_LABELS, FEATURE_MIN_PLAN, planAllows, planById, type PlanFeature } from "@/lib/plans";

/** Wraps a Growth or Enterprise module's pages (its layout.tsx). On a plan
 * without the module it says which plan has it instead of the pages. The
 * module's server actions check the plan too (requireFeature). */
export async function PlanGate({ feature, children }: { feature: PlanFeature; children: React.ReactNode }) {
  const user = await getCurrentUser();
  const plan = await getCompanyPlan(user.companyId);
  if (planAllows(plan, feature)) return children;

  const needed = planById(FEATURE_MIN_PLAN[feature]);
  // On Enterprise already, built without this add on (EDI).
  const addOn = plan.id === needed.id;
  const label = FEATURE_LABELS[feature];
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/30 light:text-blue-600">
        <Lock aria-hidden className="h-5 w-5" />
      </span>
      <h1 className="mt-5 text-xl font-semibold text-slate-50 light:text-slate-900">
        {addOn ? `${label} is an add on to your ${plan.name} plan` : `${label} comes with the ${needed.name} plan`}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-500">
        {!addOn && `Your company is on the ${plan.name} plan. `}
        {user.role !== "OWNER"
          ? `Ask your company's owner to ${addOn ? "add it" : `move to ${needed.name}`} to turn it on.`
          : addOn
            ? "Add it to your plan on the Billing page. Nothing you have now changes."
            : needed.listed
              ? `Move to ${needed.name} on the Billing page to turn it on. Nothing you have now changes.`
              : `Build your ${needed.name} plan on the Billing page to turn it on. Nothing you have now changes.`}
      </p>
      {user.role === "OWNER" && (
        <div className="mt-6">
          <LinkButton href="/dashboard/billing">{addOn || !needed.listed ? "Open Billing" : "See plans on Billing"}</LinkButton>
        </div>
      )}
    </div>
  );
}
