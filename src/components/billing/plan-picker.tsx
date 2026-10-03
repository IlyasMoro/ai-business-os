"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { aboutRand, PLANS, type BillingInterval, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

/**
 * The three plans with a monthly / yearly switch, for the Billing page.
 * `mode` decides what choosing one does: "checkout" starts a new
 * subscription, "change" moves an active one. The current plan and period
 * (when known) are marked and can't be chosen again.
 */
export function PlanPicker({
  action,
  mode,
  current,
}: {
  action: (formData: FormData) => Promise<void>;
  mode: "checkout" | "change";
  current: { planId: PlanId; interval: BillingInterval | null } | null;
}) {
  const [interval, setBillingInterval] = useState<BillingInterval>(current?.interval ?? "monthly");

  return (
    <div>
      <div role="group" aria-label="Billing period" className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1 light:border-slate-200 light:bg-slate-100">
        {(["monthly", "yearly"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={interval === value}
            onClick={() => setBillingInterval(value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              interval === value
                ? "bg-cyan-400 text-[#0a1428]"
                : "text-slate-300 hover:text-white light:text-slate-600 light:hover:text-slate-900"
            )}
          >
            {value === "monthly" ? "Monthly" : "Yearly"}
            {value === "yearly" && <span className="ml-1.5 text-xs opacity-80">2 months free</span>}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = current?.planId === plan.id && current.interval === interval;
          const price = interval === "monthly" ? plan.monthly : plan.yearly;
          return (
            <form
              key={plan.id}
              action={action}
              className={cn(
                "flex flex-col rounded-xl border p-4",
                isCurrent
                  ? "border-cyan-400/50 bg-cyan-400/[0.06]"
                  : "border-white/[0.09] bg-white/[0.02] light:border-slate-200 light:bg-white"
              )}
            >
              <input type="hidden" name="plan" value={plan.id} />
              <input type="hidden" name="interval" value={interval} />
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-50 light:text-slate-900">{plan.name}</p>
                {isCurrent ? (
                  <span className="rounded-full bg-cyan-400 px-2 py-0.5 text-[11px] font-semibold text-[#0a1428]">Current</span>
                ) : (
                  plan.popular && <span className="text-[11px] font-semibold text-cyan-400">Most popular</span>
                )}
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-50 light:text-slate-900">
                ${price.toLocaleString("en-US")}
                <span className="text-sm font-normal text-slate-400"> / {interval === "monthly" ? "month" : "year"}</span>
              </p>
              <p className="text-xs text-slate-500">{aboutRand(price)}</p>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-300 light:text-slate-600">
                {[
                  `${plan.users} users`,
                  plan.branches === null ? "Unlimited branches" : plan.branches === 1 ? "1 branch" : `Up to ${plan.branches} branches`,
                  `${plan.aiRequests.toLocaleString("en-US")} AI requests a month`,
                ].map((line) => (
                  <li key={line} className="flex items-center gap-2">
                    <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                    {line}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex-1" />
              {isCurrent ? (
                <p className="py-2 text-center text-sm text-slate-400">Your plan</p>
              ) : (
                <SubmitButton
                  pendingText="One moment..."
                  variant={plan.popular ? "primary" : "secondary"}
                  className="w-full"
                >
                  {mode === "checkout" ? `Subscribe to ${plan.name}` : `Switch to ${plan.name}`}
                </SubmitButton>
              )}
            </form>
          );
        })}
      </div>
    </div>
  );
}
