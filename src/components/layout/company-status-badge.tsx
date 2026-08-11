import Link from "next/link";
import { Building2 } from "lucide-react";
import { daysLeft } from "@/lib/date-utils";

/** Topbar badge for the signed-in company: name, plus either the trial
 * countdown or the paid-package status when a Subscription row applies.
 * Replaces the old bare company-initial pill so the trial/billing state
 * that used to live in its own dashboard-body card is visible everywhere,
 * not just the overview page. */
export function CompanyStatusBadge({
  companyName,
  subscription,
}: {
  companyName: string;
  subscription: {
    status: string;
    trialEndsAt: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}) {
  const isTrialing =
    subscription?.status === "TRIALING" && (!subscription.trialEndsAt || subscription.trialEndsAt > new Date());
  const isActive = subscription?.status === "ACTIVE";
  const isPastDue = subscription?.status === "PAST_DUE";
  const hasStatus = isTrialing || isActive || isPastDue;

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-3 backdrop-blur-md light:border-slate-200 light:bg-slate-100/70">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-blue-400/30 bg-blue-500/10 text-blue-300">
        <Building2 className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold text-slate-50 light:text-slate-900">{companyName}</p>
        {isTrialing && subscription?.trialEndsAt && (
          <p className="text-[11px] text-amber-400">
            {daysLeft(subscription.trialEndsAt)} day{daysLeft(subscription.trialEndsAt) === 1 ? "" : "s"} left
          </p>
        )}
        {isActive && (
          <p className="text-[11px] text-emerald-400">
            Active{subscription?.cancelAtPeriodEnd && " (cancels soon)"}
          </p>
        )}
        {isPastDue && <p className="text-[11px] text-red-400">Payment failed</p>}
      </div>
      {hasStatus && (
        <Link
          href="/dashboard/billing"
          className="hidden shrink-0 text-[11px] font-medium text-blue-400 underline hover:text-blue-300 sm:inline light:text-blue-600 light:hover:text-blue-700"
        >
          Manage
        </Link>
      )}
    </div>
  );
}
