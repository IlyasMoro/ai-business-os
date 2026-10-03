import { Lock } from "lucide-react";
import { LinkButton } from "@/components/ui-dark/button";
import { getCurrentUser } from "@/lib/dal";
import { getCompanyPlan } from "@/lib/plan-limits";
import { FEATURE_LABELS, FEATURE_MIN_PLAN, planById, planIncludes, type PlanFeature } from "@/lib/plans";

/** Wraps a Growth or Scale module's pages (its layout.tsx). On a plan
 * without the module it says which plan has it instead of the pages. The
 * module's server actions check the plan too (requireFeature). */
export async function PlanGate({ feature, children }: { feature: PlanFeature; children: React.ReactNode }) {
  const user = await getCurrentUser();
  const plan = await getCompanyPlan(user.companyId);
  if (planIncludes(plan.id, feature)) return children;

  const needed = planById(FEATURE_MIN_PLAN[feature]);
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-400 ring-1 ring-cyan-400/30">
        <Lock aria-hidden className="h-5 w-5" />
      </span>
      <h1 className="mt-5 text-xl font-semibold text-slate-50 light:text-slate-900">
        {FEATURE_LABELS[feature]} comes with the {needed.name} plan
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-500">
        Your company is on the {plan.name} plan.{" "}
        {user.role === "OWNER"
          ? `Move to ${needed.name} on the Billing page to turn it on. Nothing you have now changes.`
          : `Ask your company's owner to move to ${needed.name} to turn it on.`}
      </p>
      {user.role === "OWNER" && (
        <div className="mt-6">
          <LinkButton href="/dashboard/billing">See plans on Billing</LinkButton>
        </div>
      )}
    </div>
  );
}
