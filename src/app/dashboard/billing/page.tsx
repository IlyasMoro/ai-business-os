import { SettingsTabs } from "@/components/settings/settings-tabs";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { startCheckout, changePlan, confirmCheckout, confirmAiTopUp, startAiTopUp, openBillingPortal, buyEnterprise } from "@/lib/actions/billing";
import { ENTERPRISE, enterpriseFor, enterpriseQuote, type EnterpriseConfig } from "@/lib/enterprise";
import { PlanPicker } from "@/components/billing/plan-picker";
import { PlanStatusHero, TRIAL_DAYS } from "@/components/billing/plan-status-hero";
import type { BillingInterval } from "@/lib/plans";
import { updateDefaultTaxRate } from "@/lib/actions/invoicing";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { Input, Label } from "@/components/ui-dark/input";
import { ErrorBanner } from "@/components/ui/error-banner";
import { CreditCard, Gauge, Percent } from "lucide-react";
import { activeBranchCount, aiCreditsLeft, aiRequestsUsed, extraUsersBilled, getCompanyPlan, seatsUsed } from "@/lib/plan-limits";
import { AI_TOPUP_PRICE, AI_TOPUP_REQUESTS, EXTRA_USER_PRICE, EXTRA_USER_YEARLY_PRICE, recommendedPlan } from "@/lib/plans";

/** One plan allowance as "used of limit" with a bar. `limit` null means unlimited. */
/** One allowance: "used of limit" with a bar that turns amber near the
 * limit. Unlimited shows the plain count, no bar. `extendable`: going past
 * the limit is fine (extra users are billed), so it never warns. `note`: a
 * short line under it, such as extra users or bought AI requests. */
function Meter({
  label,
  used,
  limit,
  extendable = false,
  note,
}: {
  label: string;
  used: number;
  limit: number | null;
  extendable?: boolean;
  note?: string | null;
}) {
  const share = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  // A one item allowance (Solo and Starter's single branch) is always full,
  // so it never warns.
  const warn = limit !== null && limit > 1 && !extendable && used >= limit * 0.8;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-slate-300 light:text-slate-600">{label}</span>
        <span className={warn ? "font-semibold text-amber-400" : "font-semibold text-slate-50 light:text-slate-900"}>
          {used.toLocaleString("en-US")}
          {limit !== null && <span className="font-normal text-slate-400"> of {limit.toLocaleString("en-US")}</span>}
        </span>
      </div>
      {limit !== null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10 light:bg-slate-200">
          <div className={warn ? "h-full bg-amber-400" : "h-full bg-blue-500"} style={{ width: `${share}%` }} />
        </div>
      )}
      {note && <p className="mt-1.5 text-xs text-slate-400 light:text-slate-500">{note}</p>}
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
  // An Enterprise plan the company built: its own users, branches, AI and
  // EDI (lib/plan-limits.ts getCompanyPlan), priced from lib/enterprise.ts.
  const builtEnterprise = plan.id === "scale" && !plan.extraUsers;
  const builtConfig: EnterpriseConfig | null = builtEnterprise
    ? {
        users: plan.users,
        branches: plan.branches ?? ENTERPRISE.includedBranches,
        edi: plan.edi !== false,
        aiPacks: Math.max(0, Math.round((plan.aiRequests - ENTERPRISE.aiIncluded) / ENTERPRISE.aiPackSize)),
      }
    : null;
  const planPrice = interval
    ? builtConfig
      ? enterpriseQuote(builtConfig, interval).total
      : interval === "monthly"
        ? plan.monthly
        : plan.yearly
    : 0;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div>
        <SettingsTabs role={session.role} current="/dashboard/billing" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Plan and billing</h1>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
          Manage your AIBOS subscription for {session.name ? "your company" : "this workspace"}.
        </p>

        <div className="mt-4 space-y-3">
          <ErrorBanner code={error} />
          {checkout === "success" && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 light:text-emerald-700">
              Subscription confirmed. Thanks for subscribing to the {plan.name} plan.
            </div>
          )}
          {topup === "success" && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 light:text-emerald-700">
              Payment received. Your extra AI requests are ready, after this month&apos;s plan requests.
            </div>
          )}
          {changed && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 light:text-emerald-700">
              Plan changed to {plan.name}. Stripe has charged or credited the difference.
            </div>
          )}
          {checkout === "cancelled" && (
            <div className="rounded-md border border-white/[0.06] light:border-slate-200 bg-white/5 px-4 py-2 text-sm text-slate-300 light:text-slate-600">
              Checkout was cancelled. No changes were made.
            </div>
          )}
          {tax === "updated" && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 light:text-emerald-700">
              Default tax rate updated.
            </div>
          )}
        </div>

        <PlanStatusHero
          status={
            isTrialing && subscription?.trialEndsAt
              ? { kind: "trial", daysLeft: daysLeft(subscription.trialEndsAt) }
              : isTrialing
                ? { kind: "trial", daysLeft: TRIAL_DAYS }
                : subscription?.status === "TRIALING"
                  ? { kind: "trialEnded" }
                  : subscription?.status === "PAST_DUE"
                    ? { kind: "pastDue", planLabel: `${plan.name} plan` }
                    : isActive
                      ? {
                          kind: "active",
                          planLabel: legacyPrice
                            ? "AIBOS, $49 a month (earlier price)"
                            : `${plan.name}${builtConfig ? ` for ${builtConfig.users} users` : ""}, $${planPrice.toLocaleString("en-US")} a ${interval === "monthly" ? "month" : "year"}`,
                          renewsOn: subscription?.currentPeriodEnd ?? null,
                          cancelling: Boolean(subscription?.cancelAtPeriodEnd),
                        }
                      : { kind: "none" }
          }
        />

        <section id="plans" className="mt-6 scroll-mt-24 rounded-2xl border border-white/[0.09] p-5 glass sm:p-6 light:border-white/80">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/5 text-slate-300 light:border-slate-200 light:text-slate-600">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-50 light:text-slate-900">{isActive ? "Change plan" : "Choose a plan"}</h2>
              <p className="text-sm text-slate-400 light:text-slate-500">
                {isActive
                  ? "Change plan or billing period. Stripe charges or credits the difference straight away."
                  : "Prices are in US dollars; Rand amounts are a guide. Cancel any time."}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <PlanPicker
              action={isActive ? changePlan : startCheckout}
              mode={isActive ? "change" : "checkout"}
              current={isActive && interval && !builtEnterprise ? { planId: plan.id, interval } : null}
              recommended={recommendedPlan(seats, branches).id}
              teamSummary={`You have ${seats} ${seats === 1 ? "user" : "users"}, ${branches} active ${branches === 1 ? "branch" : "branches"} and used ${aiUsed.toLocaleString("en-US")} AI ${aiUsed === 1 ? "request" : "requests"} this month`}
              enterprise={{
                action: buyEnterprise,
                initial: builtConfig ?? enterpriseFor(seats, branches),
                initialInterval: interval ?? null,
                minUsers: seats,
                minBranches: branches,
                built: Boolean(builtEnterprise),
                submitLabel: builtEnterprise ? "Update my plan" : isActive ? "Switch to Enterprise" : "Subscribe to Enterprise",
              }}
            />
          </div>

        </section>


          {hasStripeCustomer && (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/[0.09] p-5 glass light:border-white/80">
              <form action={openBillingPortal}>
                <SubmitButton variant="secondary" pendingText="Redirecting...">
                  Manage billing
                </SubmitButton>
              </form>
              <p className="text-sm text-slate-400 light:text-slate-500">Card, invoices and cancelling, on Stripe.</p>
            </div>
          )}

        {/* During a trial the plan list's summary line carries the usage, so
            this card is for companies on a plan. */}
        {!isTrialing && (
          <div className="mt-6 rounded-2xl border border-white/[0.09] light:border-white/80 p-5 glass">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] light:border-slate-200 bg-white/5 text-slate-300 light:text-slate-600">
                <Gauge className="h-5 w-5" />
              </span>
              <p className="font-semibold text-slate-50 light:text-slate-900">Your usage</p>
            </div>
            <div className="mt-4 grid gap-5 border-t border-white/[0.06] pt-4 sm:grid-cols-3 light:border-slate-200">
              {/* Users count open invites, which hold a seat until accepted or expired. */}
              <Meter
                label="Users"
                used={seats}
                limit={plan.users}
                extendable={isActive && Boolean(interval) && plan.extraUsers}
                note={
                  extraUsers > 0 && interval
                    ? `+ ${extraUsers} extra at $${interval === "monthly" ? `${EXTRA_USER_PRICE} a month` : `${EXTRA_USER_YEARLY_PRICE} a year`}`
                    : null
                }
              />
              <Meter label="Branches" used={branches} limit={plan.branches} />
              <Meter
                label="AI requests this month"
                used={aiUsed}
                limit={plan.aiRequests}
                note={aiCredits > 0 ? `+ ${aiCredits.toLocaleString("en-US")} bought, never expire` : null}
              />
            </div>
            {/* Top-ups only once they'd help: most of the month's requests used, or some already bought. */}
            {(aiUsed >= plan.aiRequests * 0.8 || aiCredits > 0) && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4 light:border-slate-200">
                <p className="text-sm text-slate-300 light:text-slate-600">
                  {aiUsed >= plan.aiRequests * 0.8 ? "Running low on AI requests?" : "Need more AI requests?"} Bought
                  requests are used after the monthly ones and never expire.
                </p>
                <form action={startAiTopUp}>
                  <SubmitButton variant="secondary" pendingText="Redirecting...">
                    Buy {AI_TOPUP_REQUESTS} for ${AI_TOPUP_PRICE}
                  </SubmitButton>
                </form>
              </div>
            )}
          </div>
        )}

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
