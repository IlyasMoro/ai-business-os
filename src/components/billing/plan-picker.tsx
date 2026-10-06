"use client";

import { useState } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { aboutRand, EXTRA_USER_PRICE, EXTRA_USER_YEARLY_PRICE, LISTED_PLANS, PLANS, planById, type BillingInterval, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

/**
 * The plans as one selectable list with a single button, for the Billing
 * page. Each row shows users, branches and AI requests in short, plus what
 * the plan adds. `recommended` (the smallest plan that fits the team) is
 * tagged and picked first. Only plans on sale are offered, plus the
 * company's own plan if it's on an older one; a team too big for any plan
 * on sale is pointed to the Enterprise builder below it. `mode` decides what the button does: "checkout"
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
  const offered = PLANS.filter((p) => p.listed || p.id === current?.planId);
  const needsSales = !offered.some((p) => p.id === recommended);
  const [interval, setBillingInterval] = useState<BillingInterval>(current?.interval ?? "monthly");
  const [selected, setSelected] = useState<PlanId>(
    current && current.planId !== recommended ? current.planId : needsSales ? (offered[offered.length - 1] ?? LISTED_PLANS[0]).id : recommended
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

      <fieldset className={cn("mt-5 grid gap-4", offered.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
        <legend className="sr-only">Choose a plan</legend>
        {offered.map((plan) => {
          const on = selected === plan.id;
          const price = priceOf(plan.id);
          const branches =
            plan.branches === null ? "Unlimited branches" : plan.branches === 1 ? "1 branch" : `Up to ${plan.branches} branches`;
          const badge = isCurrent(plan.id) ? "Current plan" : plan.id === recommended ? "Fits your team" : plan.popular ? "Most popular" : null;
          return (
            <label
              key={plan.id}
              className={cn(
                "relative flex cursor-pointer flex-col rounded-2xl border p-5 transition-all",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500",
                on
                  ? "border-blue-500 bg-blue-500/10 shadow-[0_0_0_1px_rgb(59_130_246),0_12px_40px_-12px_rgb(59_130_246/0.6)] light:bg-blue-50"
                  : "border-white/[0.1] hover:-translate-y-0.5 hover:border-white/25 light:border-slate-200 light:bg-white light:hover:border-slate-300"
              )}
            >
              <input type="radio" name="plan" value={plan.id} checked={on} onChange={() => setSelected(plan.id)} className="sr-only" />
              {badge && (
                <span
                  className={cn(
                    "absolute -top-3 left-5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                    badge === "Most popular" ? "border border-blue-500/60 bg-slate-950 text-blue-300 light:bg-white light:text-blue-700" : "bg-blue-600 text-white"
                  )}
                >
                  {badge}
                </span>
              )}
              <div className="flex items-start justify-between gap-3">
                <span className="text-lg font-semibold text-slate-50 light:text-slate-900">{plan.name}</span>
                <span
                  aria-hidden
                  className={cn(
                    "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                    on ? "border-blue-500 bg-blue-500 text-white" : "border-slate-500"
                  )}
                >
                  {on && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-400 light:text-slate-500">{plan.tagline}</p>
              <p className="mt-4">
                <span className="text-4xl font-bold tracking-tight text-slate-50 light:text-slate-900">${price.toLocaleString("en-US")}</span>
                <span className="text-sm text-slate-400"> / {interval === "monthly" ? "month" : "year"}</span>
              </p>
              <p className="text-xs text-slate-500">{aboutRand(price)}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-300 light:text-slate-600">
                {[`${plan.users} users included`, branches, `${plan.aiRequests.toLocaleString("en-US")} AI Copilot requests a month`, ...(plan.adds ? [plan.adds] : [])].map(
                  (line) => (
                    <li key={line} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                      <span>{line}</span>
                    </li>
                  )
                )}
              </ul>
            </label>
          );
        })}
      </fieldset>

      {needsSales && (
        <p className="mt-3 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200 light:text-blue-800">
          Your team is bigger than the plans above allow, so it needs the {planById(recommended).name} plan.{" "}
          <a href="#enterprise" className="font-medium underline">
            Build it below
          </a>
        </p>
      )}

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
          <SubmitButton
            pendingText="One moment..."
            className="h-auto w-full rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 sm:w-auto"
          >
            {mode === "checkout" ? "Subscribe to" : "Switch to"} {chosen.name} · ${priceOf(selected).toLocaleString("en-US")}/{per}
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
