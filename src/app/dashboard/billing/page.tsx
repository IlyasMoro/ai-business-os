import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { startCheckout, changePlan, confirmCheckout, confirmAiTopUp, startAiTopUp, openBillingPortal } from "@/lib/actions/billing";
import { PlanPicker } from "@/components/billing/plan-picker";
import type { BillingInterval } from "@/lib/plans";
import { updateDefaultTaxRate } from "@/lib/actions/invoicing";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { Input, Label } from "@/components/ui-dark/input";
import { ErrorBanner } from "@/components/ui/error-banner";
import { CreditCard, Gauge, Percent } from "lucide-react";
import { activeBranchCount, aiCreditsLeft, aiRequestsUsed, extraUsersBilled, getCompanyPlan, seatsUsed } from "@/lib/plan-limits";
import { AI_TOPUP_PRICE, AI_TOPUP_REQUESTS, EXTRA_USER_PRICE, EXTRA_USER_YEARLY_PRICE } from "@/lib/plans";

/** One plan allowance as "used of limit" with a bar. `limit` null means unlimited. */
/** `extendable`: going past the limit is fine (extra users are billed), so it isn't shown as a warning. */
function Meter({ label, used, limit, extendable = false }: { label: string; used: number; limit: number | null; extendable?: boolean }) {
  const share = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const full = limit !== null && used >= limit && !extendable;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-slate-300 light:text-slate-600">{label}</span>
        <span className={full ? "font-medium text-amber-400" : "font-medium text-slate-50 light:text-slate-900"}>
          {used.toLocaleString("en-US")} of {limit === null ? "unlimited" : limit.toLocaleString("en-US")}
        </span>
      </div>
      {limit !== null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10 light:bg-slate-200">
          <div className={full ? "h-full bg-amber-400" : "h-full bg-blue-500"} style={{ width: `${share}%` }} />
        </div>
      )}
    </div>
  );
}

function daysLeft(date: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; topup?: string; session_id?: string; changed?: string; error?: string; tax?: string }>;
}) {
  const session = await requireRole(["OWNER"]);
  const { checkout, topup, session_id: checkoutSessionId, changed, error, tax } = await searchParams;

  // Back from Stripe Checkout: record the plan or the top-up now rather than wait for the webhook.
  if (checkout === "success" && checkoutSessionId) await confirmCheckout(checkoutSessionId);
  if (topup === "success" && checkoutSessionId) await confirmAiTopUp(checkoutSessionId);

  const [subscription, company, plan, seats, branches, aiUsed, extraUsers, aiCredits] = await Promise.all([
    db.subscription.findUnique({ where: { companyId: session.companyId } }),
    db.company.findUnique({ where: { id: session.companyId }, select: { defaultTaxRate: true } }),
    getCompanyPlan(session.companyId),
    seatsUsed(session.companyId),
    activeBranchCount(session.companyId),
    aiRequestsUsed(session.companyId),
    extraUsersBilled(session.companyId),
    aiCreditsLeft(session.companyId),
  ]);

  const isActive = subscription?.status === "ACTIVE";
  const isTrialing =
    subscription?.status === "TRIALING" &&
    (!subscription.trialEndsAt || subscription.trialEndsAt > new Date());
  const hasStripeCustomer = Boolean(subscription?.stripeCustomerId);
  const interval = (subscription?.billingInterval ?? null) as BillingInterval | null;
  // Paying on the old single $49 price: no plan price yet, but switching moves them onto one.
  const legacyPrice = isActive && !interval;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Subscription</h1>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
          Manage your AIBOS subscription for {session.name ? "your company" : "this workspace"}.
        </p>

        <div className="mt-4 space-y-3">
          <ErrorBanner code={error} />
          {checkout === "success" && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
              Subscription confirmed. Thanks for subscribing to the {plan.name} plan.
            </div>
          )}
          {topup === "success" && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
              Payment received. Your extra AI requests are ready, after this month&apos;s plan requests.
            </div>
          )}
          {changed && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
              Plan changed to {plan.name}. Stripe has charged or credited the difference.
            </div>
          )}
          {checkout === "cancelled" && (
            <div className="rounded-md border border-white/[0.06] light:border-slate-200 bg-white/5 px-4 py-2 text-sm text-slate-300 light:text-slate-600">
              Checkout was cancelled. No changes were made.
            </div>
          )}
          {tax === "updated" && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
              Default tax rate updated.
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-white/[0.09] light:border-white/80 p-5 glass">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] light:border-slate-200 bg-white/5 text-slate-300 light:text-slate-600">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-slate-50 light:text-slate-900">
                {isActive && interval
                  ? `${plan.name} plan, $${(interval === "monthly" ? plan.monthly : plan.yearly).toLocaleString("en-US")} a ${interval === "monthly" ? "month" : "year"}`
                  : legacyPrice
                    ? "AIBOS, $49 a month (earlier price)"
                    : isTrialing
                      ? "Free trial with every module"
                      : "AIBOS"}
              </p>
              {!subscription && (
                <p className="text-sm text-slate-400 light:text-slate-500">No subscription yet.</p>
              )}
              {isTrialing && subscription?.trialEndsAt && (
                <p className="text-sm text-amber-400">
                  Trial: {daysLeft(subscription.trialEndsAt)} day
                  {daysLeft(subscription.trialEndsAt) === 1 ? "" : "s"} left
                </p>
              )}
              {isActive && (
                <p className="text-sm text-emerald-400">
                  Active
                  {subscription?.currentPeriodEnd &&
                    ` (renews ${subscription.currentPeriodEnd.toLocaleDateString()})`}
                  {subscription?.cancelAtPeriodEnd && " (cancels at period end)"}
                </p>
              )}
              {subscription?.status === "PAST_DUE" && (
                <p className="text-sm text-red-400">Payment failed. Please update your card.</p>
              )}
              {subscription?.status === "CANCELED" && (
                <p className="text-sm text-slate-400 light:text-slate-500">Canceled.</p>
              )}
            </div>
          </div>

          <div className="mt-5 border-t border-white/[0.06] pt-4 light:border-slate-200">
            <p className="mb-3 text-sm text-slate-400 light:text-slate-500">
              {isActive
                ? "Change plan or billing period. Stripe charges or credits the difference straight away."
                : "Choose a plan to subscribe. Prices are in US dollars; Rand amounts are a guide."}
            </p>
            <PlanPicker
              action={isActive ? changePlan : startCheckout}
              mode={isActive ? "change" : "checkout"}
              current={isActive && interval ? { planId: plan.id, interval } : null}
            />
          </div>

          {hasStripeCustomer && (
            <div className="mt-5 flex items-center gap-3 border-t border-white/[0.06] light:border-slate-200 pt-4">
              <form action={openBillingPortal}>
                <SubmitButton variant="secondary" pendingText="Redirecting...">
                  Manage billing
                </SubmitButton>
              </form>
              <p className="text-sm text-slate-400 light:text-slate-500">Card, invoices and cancelling, on Stripe.</p>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-white/[0.09] light:border-white/80 p-5 glass">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] light:border-slate-200 bg-white/5 text-slate-300 light:text-slate-600">
              <Gauge className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-slate-50 light:text-slate-900">
                {isTrialing ? "Usage during your trial" : `Usage on the ${plan.name} plan`}
              </p>
              <p className="text-sm text-slate-400 light:text-slate-500">How much of your plan is in use.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 border-t border-white/[0.06] pt-4 sm:grid-cols-3 light:border-slate-200">
            {/* Open invites hold a seat until they are accepted or expire. */}
            <Meter label="Users and open invites" used={seats} limit={plan.users} extendable={isActive && Boolean(interval)} />
            <Meter label="Active branches" used={branches} limit={plan.branches} />
            <Meter label="AI requests this month" used={aiUsed} limit={plan.aiRequests} />
          </div>
          {/* Bought AI requests: used once the plan's monthly ones run out, never expire. */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4 light:border-slate-200">
            <p className="text-sm text-slate-300 light:text-slate-600">
              Extra AI requests left:{" "}
              <span className="font-semibold text-slate-50 light:text-slate-900">{aiCredits.toLocaleString("en-US")}</span>
              <span className="text-slate-500"> · used after the monthly ones, never expire</span>
            </p>
            <form action={startAiTopUp}>
              <SubmitButton variant="secondary" pendingText="Redirecting...">
                Buy {AI_TOPUP_REQUESTS} for ${AI_TOPUP_PRICE}
              </SubmitButton>
            </form>
          </div>
          {extraUsers > 0 && interval && (
            <p className="mt-4 text-sm text-slate-300 light:text-slate-600">
              {extraUsers} extra user{extraUsers === 1 ? "" : "s"} above the {plan.users} included, at $
              {interval === "monthly" ? `${EXTRA_USER_PRICE} a month` : `${EXTRA_USER_YEARLY_PRICE} a year`} each:{" "}
              <span className="font-semibold text-slate-50 light:text-slate-900">
                ${(extraUsers * (interval === "monthly" ? EXTRA_USER_PRICE : EXTRA_USER_YEARLY_PRICE)).toLocaleString("en-US")} a{" "}
                {interval === "monthly" ? "month" : "year"}
              </span>
              .
            </p>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-white/[0.09] light:border-white/80 p-5 glass">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] light:border-slate-200 bg-white/5 text-slate-300 light:text-slate-600">
              <Percent className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-slate-50 light:text-slate-900">Default tax rate</p>
              <p className="text-sm text-slate-400 light:text-slate-500">
                Applied automatically to new invoices. Editable per invoice.
              </p>
            </div>
          </div>

          <form action={updateDefaultTaxRate} className="mt-5 flex items-end gap-3 border-t border-white/[0.06] light:border-slate-200 pt-4">
            <div>
              <Label htmlFor="defaultTaxRate">Tax rate (%)</Label>
              <Input
                id="defaultTaxRate"
                name="defaultTaxRate"
                type="number"
                step="0.01"
                min="0"
                defaultValue={company?.defaultTaxRate ?? 0}
                className="w-32"
                required
              />
            </div>
            <SubmitButton pendingText="Saving...">Save</SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
