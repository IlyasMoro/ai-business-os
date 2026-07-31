import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { startCheckout, openBillingPortal } from "@/lib/actions/billing";
import { updateDefaultTaxRate } from "@/lib/actions/invoicing";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { Input, Label } from "@/components/ui-dark/input";
import { ErrorBanner } from "@/components/ui/error-banner";
import { CreditCard, Percent } from "lucide-react";

function daysLeft(date: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; error?: string; tax?: string }>;
}) {
  const session = await requireRole(["OWNER"]);
  const { checkout, error, tax } = await searchParams;

  const [subscription, company] = await Promise.all([
    db.subscription.findUnique({ where: { companyId: session.companyId } }),
    db.company.findUnique({ where: { id: session.companyId }, select: { defaultTaxRate: true } }),
  ]);

  const isActive = subscription?.status === "ACTIVE";
  const isTrialing =
    subscription?.status === "TRIALING" &&
    (!subscription.trialEndsAt || subscription.trialEndsAt > new Date());
  const hasStripeCustomer = Boolean(subscription?.stripeCustomerId);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Subscription</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        Manage your AIBOS subscription for {session.name ? "your company" : "this workspace"}.
      </p>

      <div className="mt-4 max-w-2xl space-y-3">
        <ErrorBanner code={error} />
        {checkout === "success" && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            Subscription confirmed. Thanks for subscribing.
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

      <div className="mt-6 max-w-2xl rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] light:border-slate-200 bg-white/5 text-slate-300 light:text-slate-600">
            <CreditCard className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium text-slate-50 light:text-slate-900">AIBOS ($49/month)</p>
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

        <div className="mt-5 flex items-center gap-2 border-t border-white/[0.06] light:border-slate-200 pt-4">
          {!isActive && (
            <form action={startCheckout}>
              <SubmitButton pendingText="Redirecting...">Subscribe for $49/month</SubmitButton>
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

      <div className="mt-6 max-w-2xl rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] light:border-slate-200 bg-white/5 text-slate-300 light:text-slate-600">
            <Percent className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium text-slate-50 light:text-slate-900">Default tax rate</p>
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
  );
}
