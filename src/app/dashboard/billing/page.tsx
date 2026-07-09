import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { startCheckout, openBillingPortal } from "@/lib/actions/billing";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { CreditCard } from "lucide-react";

function daysLeft(date: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; error?: string }>;
}) {
  const session = await requireRole(["OWNER"]);
  const { checkout, error } = await searchParams;

  const subscription = await db.subscription.findUnique({ where: { companyId: session.companyId } });

  const isActive = subscription?.status === "ACTIVE";
  const isTrialing =
    subscription?.status === "TRIALING" &&
    (!subscription.trialEndsAt || subscription.trialEndsAt > new Date());
  const hasStripeCustomer = Boolean(subscription?.stripeCustomerId);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50">Billing</h1>
      <p className="mt-1 text-sm text-slate-400">
        Manage your Business OS subscription for {session.name ? "your company" : "this workspace"}.
      </p>

      <div className="mt-4 max-w-2xl space-y-3">
        <ErrorBanner code={error} />
        {checkout === "success" && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            Subscription confirmed. Thanks for subscribing.
          </div>
        )}
        {checkout === "cancelled" && (
          <div className="rounded-md border border-white/[0.06] bg-white/5 px-4 py-2 text-sm text-slate-300">
            Checkout was cancelled — no changes were made.
          </div>
        )}
      </div>

      <div className="mt-6 max-w-2xl rounded-2xl border border-white/[0.06] bg-[#111111] p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/5 text-slate-300">
            <CreditCard className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium text-slate-50">Business OS — $49/month</p>
            {!subscription && (
              <p className="text-sm text-slate-400">No subscription yet.</p>
            )}
            {isTrialing && subscription?.trialEndsAt && (
              <p className="text-sm text-amber-400">
                Trial — {daysLeft(subscription.trialEndsAt)} day
                {daysLeft(subscription.trialEndsAt) === 1 ? "" : "s"} left
              </p>
            )}
            {isActive && (
              <p className="text-sm text-emerald-400">
                Active
                {subscription?.currentPeriodEnd &&
                  ` — renews ${subscription.currentPeriodEnd.toLocaleDateString()}`}
                {subscription?.cancelAtPeriodEnd && " (cancels at period end)"}
              </p>
            )}
            {subscription?.status === "PAST_DUE" && (
              <p className="text-sm text-red-400">Payment failed — please update your card.</p>
            )}
            {subscription?.status === "CANCELED" && (
              <p className="text-sm text-slate-400">Canceled.</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 border-t border-white/[0.06] pt-4">
          {!isActive && (
            <form action={startCheckout}>
              <SubmitButton pendingText="Redirecting...">Subscribe — $49/month</SubmitButton>
            </form>
          )}
          {hasStripeCustomer && (
            <form action={openBillingPortal}>
              <SubmitButton variant="secondary" pendingText="Redirecting...">
                Manage billing
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
