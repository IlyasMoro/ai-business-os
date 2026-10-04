"use client";

import { useState } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { aboutRand, EXTRA_USER_PRICE, EXTRA_USER_YEARLY_PRICE, PLANS, planById, type BillingInterval, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

/**
 * The plans as one selectable list with a single button, for the Billing
 * page. Each row shows users, branches and AI requests in short, plus what
 * the plan adds. `recommended` (the smallest plan that fits the team) is
 * tagged and picked first. `mode` decides what the button does: "checkout"
 * starts a subscription, "change" moves an active one; the current plan and
 * period are marked and can't be submitted again.
 */
export function PlanPicker({
  action,
  mode,
  current,
  recommended,
  teamSummary,
}: {
  action: (formData: FormData) => Promise<void>;
  mode: "checkout" | "change";
  current: { planId: PlanId; interval: BillingInterval | null } | null;
  recommended: PlanId;
  /** e.g. "You have 7 users and 1 branch". */
  teamSummary: string;
}) {
  const [interval, setBillingInterval] = useState<BillingInterval>(current?.interval ?? "monthly");
  const [selected, setSelected] = useState<PlanId>(
    current && current.planId !== recommended ? current.planId : recommended
  );

  const isCurrent = (id: PlanId) => current?.planId === id && current.interval === interval;
  const priceOf = (id: PlanId) => {
    const plan = planById(id);
    return interval === "monthly" ? plan.monthly : plan.yearly;
  };
  const per = interval === "monthly" ? "month" : "year";
  const chosen = planById(selected);

  return (
    <form action={action}>
      <input type="hidden" name="interval" value={interval} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Billing period"
          className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1 light:border-slate-200 light:bg-slate-100"
        >
          {(["monthly", "yearly"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={interval === value}
              onClick={() => setBillingInterval(value)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                interval === value
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:text-white light:text-slate-600 light:hover:text-slate-900"
              )}
            >
              {value === "monthly" ? "Monthly" : "Yearly"}
              {value === "yearly" && <span className="ml-1.5 text-xs opacity-80">2 months free</span>}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-400 light:text-slate-500">{teamSummary}</p>
      </div>

      <fieldset className="mt-4 space-y-2">
        <legend className="sr-only">Choose a plan</legend>
        {PLANS.map((plan) => {
          const on = selected === plan.id;
          const price = priceOf(plan.id);
          const branches =
            plan.branches === null ? "unlimited branches" : plan.branches === 1 ? "1 branch" : `${plan.branches} branches`;
          return (
            <label
              key={plan.id}
              className={cn(
                "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 transition-colors sm:grid-cols-[auto_8.5rem_minmax(0,1fr)_auto]",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500",
                on
                  ? "border-blue-500/60 bg-blue-500/10"
                  : "border-white/[0.08] hover:border-white/20 light:border-slate-200 light:hover:border-slate-300"
              )}
            >
              <input
                type="radio"
                name="plan"
                value={plan.id}
                checked={on}
                onChange={() => setSelected(plan.id)}
                className="h-4 w-4 accent-blue-500"
              />
              <span className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-50 light:text-slate-900">
                {plan.name}
                {isCurrent(plan.id) ? (
                  <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10.5px] font-medium text-white">Current</span>
                ) : plan.id === recommended ? (
                  <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10.5px] font-medium text-white">Fits you</span>
                ) : (
                  plan.popular && (
                    <span className="rounded-full border border-blue-500/60 px-2 py-0.5 text-[10.5px] font-medium text-blue-300 light:text-blue-700">
                      Popular
                    </span>
                  )
                )}
              </span>
              {/* On phones the details drop under the name. */}
              <span className="col-start-2 row-start-2 text-xs leading-relaxed text-slate-400 sm:col-start-3 sm:row-start-1 light:text-slate-500">
                {plan.users} users · {branches} · {plan.aiRequests.toLocaleString("en-US")} AI
                {plan.adds && <span className="block text-blue-300 light:text-blue-700">+ {plan.adds}</span>}
              </span>
              <span className="col-start-3 row-start-1 row-span-2 text-right sm:col-start-4 sm:row-span-1">
                <span className="block text-sm font-semibold text-slate-50 light:text-slate-900">
                  ${price.toLocaleString("en-US")}
                  <span className="font-normal text-slate-400"> /{interval === "monthly" ? "mo" : "yr"}</span>
                </span>
                <span className="block text-[11px] text-slate-500">{aboutRand(price)}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400 light:text-slate-500">
          Extra users ${interval === "monthly" ? `${EXTRA_USER_PRICE} a month` : `${EXTRA_USER_YEARLY_PRICE} a year`} each on Starter
          and up ·{" "}
          <Link href="/pricing#compare" className="text-blue-400 hover:text-blue-300 light:text-blue-700">
            Compare every feature
          </Link>
        </p>
        {isCurrent(selected) ? (
          <p className="text-sm text-slate-400">You&apos;re on this plan</p>
        ) : (
          <SubmitButton pendingText="One moment...">
            {mode === "checkout" ? "Subscribe to" : "Switch to"} {chosen.name} · ${priceOf(selected).toLocaleString("en-US")}/{per}
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
