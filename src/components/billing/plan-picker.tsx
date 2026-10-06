"use client";

import { useState } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { EnterpriseBuilder } from "@/components/billing/enterprise-builder";
import { aboutRand, CUSTOM_PLAN, ENTERPRISE_CONTACT_HREF, EXTRA_USER_PRICE, EXTRA_USER_YEARLY_PRICE, PLANS, planById, type BillingInterval, type PlanId } from "@/lib/plans";
import { ENTERPRISE, DEFAULT_ENTERPRISE, enterpriseQuote, type EnterpriseConfig } from "@/lib/enterprise";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type Choice = PlanId | "enterprise";

// Short, so they fit in two lines and the cards stay compact; the pricing page keeps the long taglines.
const SHORT_TAGLINE: Partial<Record<Choice, string>> = {
  solo: "One person, the essentials.",
  starter: "One location, everything in one place.",
  growth: "For a business with a few branches.",
  business: "For larger teams across branches.",
  enterprise: "Many branches. Build your own plan.",
};

/**
 * Every plan side by side for the Billing page, Enterprise included as the
 * last card. One Monthly/Yearly switch drives all of them. Picking a priced
 * plan shows its single subscribe button; picking Enterprise opens the
 * builder (users, branches, AI requests, EDI) under the cards with its own
 * button, since it posts to a different action. `recommended` (the smallest
 * plan that fits the team) is tagged and picked first; a team too big for
 * any plan on sale starts on Enterprise. `mode`: "checkout" starts a
 * subscription, "change" moves an active one; the current plan and period
 * are marked and can't be submitted again.
 */
export function PlanPicker({
  action,
  mode,
  current,
  recommended,
  teamSummary,
  enterprise,
}: {
  action: (formData: FormData) => Promise<void>;
  mode: "checkout" | "change";
  current: { planId: PlanId; interval: BillingInterval | null } | null;
  recommended: PlanId;
  /** e.g. "You have 7 users and 1 branch". */
  teamSummary: string;
  enterprise: {
    action: (formData: FormData) => Promise<void>;
    initial: EnterpriseConfig;
    minUsers: number;
    minBranches: number;
    submitLabel: string;
    /** The company already has a built Enterprise plan. */
    built: boolean;
    initialInterval: BillingInterval | null;
  };
}) {
  const offered = PLANS.filter((p) => p.listed || p.id === current?.planId).filter((p) => p.id !== CUSTOM_PLAN.id);
  const needsSales = !offered.some((p) => p.id === recommended);
  const [interval, setBillingInterval] = useState<BillingInterval>(current?.interval ?? enterprise.initialInterval ?? "monthly");
  const [selected, setSelected] = useState<Choice>(() => {
    if (enterprise.built || needsSales) return "enterprise";
    if (current && current.planId !== recommended) return current.planId;
    return recommended;
  });

  const isCurrent = (id: Choice) => id !== "enterprise" && current?.planId === id && current.interval === interval;
  const priceOf = (id: PlanId) => {
    const plan = planById(id);
    return interval === "monthly" ? plan.monthly : plan.yearly;
  };
  const per = interval === "monthly" ? "month" : "year";
  const entFrom = enterpriseQuote(DEFAULT_ENTERPRISE, interval).total;

  const cards: {
    id: Choice;
    name: string;
    tagline: string;
    price: string;
    /** Enterprise starts at its price; shown as a small "From". */
    from?: boolean;
    rand: string;
    lines: string[];
    badge: string | null;
  }[] = [
    ...offered.map((plan) => {
      const price = priceOf(plan.id);
      return {
        id: plan.id as Choice,
        name: plan.name,
        tagline: SHORT_TAGLINE[plan.id] ?? plan.tagline,
        price: `$${price.toLocaleString("en-US")}`,
        rand: aboutRand(price),
        lines: [
          `${plan.users} users included`,
          plan.branches === null ? "Unlimited branches" : plan.branches === 1 ? "1 branch" : `Up to ${plan.branches} branches`,
          `${plan.aiRequests.toLocaleString("en-US")} AI requests a month`,
          ...(plan.adds ? [plan.adds] : []),
        ],
        badge: isCurrent(plan.id) ? "Current plan" : plan.id === recommended ? "Fits your team" : plan.popular ? "Most popular" : null,
      };
    }),
    {
      id: "enterprise",
      name: CUSTOM_PLAN.name,
      tagline: SHORT_TAGLINE.enterprise!,
      price: `$${entFrom.toLocaleString("en-US")}`,
      from: true,
      rand: aboutRand(entFrom),
      lines: [
        `${ENTERPRISE.minUsers}+ users, $${ENTERPRISE.perUser} each`,
        `${ENTERPRISE.includedBranches} branches, more at $${ENTERPRISE.perBranch}`,
        `${ENTERPRISE.aiIncluded.toLocaleString("en-US")} AI requests a month`,
        `EDI add on, $${ENTERPRISE.ediPrice} a month`,
      ],
      badge: enterprise.built ? "Your plan" : needsSales ? "Fits your team" : null,
    },
  ];

  const chosen = selected === "enterprise" ? null : planById(selected);

  return (
    <div>
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

      <fieldset className={cn("mt-5 grid gap-3 sm:grid-cols-2", cards.length >= 4 ? "xl:grid-cols-4" : "lg:grid-cols-3")}>
        <legend className="sr-only">Choose a plan</legend>
        {cards.map((card) => {
          const on = selected === card.id;
          const ent = card.id === "enterprise";
          return (
            <label
              key={card.id}
              className={cn(
                "relative flex min-w-0 cursor-pointer flex-col rounded-xl border px-4 pb-4 pt-4 transition-all",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500",
                on
                  ? ent
                    ? "border-violet-500 bg-violet-500/10 shadow-[0_0_0_1px_rgb(139_92_246),0_12px_40px_-12px_rgb(139_92_246/0.6)] light:bg-violet-50"
                    : "border-blue-500 bg-blue-500/10 shadow-[0_0_0_1px_rgb(59_130_246),0_12px_40px_-12px_rgb(59_130_246/0.6)] light:bg-blue-50"
                  : "border-white/[0.1] hover:-translate-y-0.5 hover:border-white/25 light:border-slate-200 light:bg-white light:hover:border-slate-300"
              )}
            >
              <input type="radio" name="plan-choice" value={card.id} checked={on} onChange={() => setSelected(card.id)} className="sr-only" />
              {card.badge && (
                <span
                  className={cn(
                    "absolute -top-2.5 left-4 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                    card.badge === "Most popular"
                      ? "border border-blue-500/60 bg-slate-950 text-blue-300 light:bg-white light:text-blue-700"
                      : ent
                        ? "bg-violet-600 text-white"
                        : "bg-blue-600 text-white"
                  )}
                >
                  {card.badge}
                </span>
              )}
              <div className="flex items-start justify-between gap-3">
                <span className="text-base font-semibold text-slate-50 light:text-slate-900">{card.name}</span>
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2",
                    on ? (ent ? "border-violet-500 bg-violet-500 text-white" : "border-blue-500 bg-blue-500 text-white") : "border-slate-500"
                  )}
                >
                  {on && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
              </div>
              {/* Two lines on every card, so the prices line up. */}
              <p className="mt-0.5 line-clamp-2 min-h-[2.25rem] text-[13px] leading-[1.125rem] text-slate-400 light:text-slate-500">{card.tagline}</p>
              <p className="mt-3 flex items-baseline gap-1.5 whitespace-nowrap">
                {card.from && <span className="text-sm font-medium text-slate-300 light:text-slate-600">From</span>}
                <span className="text-2xl font-bold leading-none tracking-tight tabular-nums text-slate-50 light:text-slate-900">{card.price}</span>
                <span className="text-sm text-slate-400 light:text-slate-500">/ {per}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">{card.rand}</p>
              <ul className="mt-3 space-y-1.5 border-t border-white/[0.07] pt-3 text-[13px] leading-[1.125rem] text-slate-300 light:border-slate-200 light:text-slate-600">
                {card.lines.map((line) => (
                  <li key={line} className="flex gap-2">
                    <Check className={cn("mt-px h-4 w-4 shrink-0", ent ? "text-violet-400" : "text-emerald-400")} aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </label>
          );
        })}
      </fieldset>

      {selected === "enterprise" ? (
        <form action={enterprise.action} className="mt-4 rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-600/10 to-transparent p-4 sm:p-5 light:from-violet-50">
          <h3 className="text-base font-semibold text-slate-50 light:text-slate-900">
            {enterprise.built ? "Change your Enterprise plan" : "Build your Enterprise plan"}
          </h3>
          <p className="mb-4 mt-1 text-sm text-slate-400 light:text-slate-500">
            {enterprise.built
              ? "Change users, branches, AI requests or EDI. Stripe charges or credits the difference straight away."
              : "Everything in Growth, with as many users and branches as you need."}{" "}
            Contracts or invoicing instead of a card?{" "}
            <Link href={ENTERPRISE_CONTACT_HREF} className="text-blue-400 hover:text-blue-300 light:text-blue-700">
              Talk to us
            </Link>
          </p>
          <EnterpriseBuilder tone="app" interval={interval} initial={enterprise.initial} minUsers={enterprise.minUsers} minBranches={enterprise.minBranches}>
            <SubmitButton
              pendingText="Working..."
              className="h-auto w-full rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/25 hover:bg-violet-500 sm:w-auto"
            >
              {enterprise.submitLabel}
            </SubmitButton>
          </EnterpriseBuilder>
        </form>
      ) : (
        <form action={action} className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <input type="hidden" name="interval" value={interval} />
          <input type="hidden" name="plan" value={selected} />
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
              className="h-auto w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 hover:bg-blue-500 sm:w-auto"
            >
              {mode === "checkout" ? "Subscribe to" : "Switch to"} {chosen!.name} · ${priceOf(chosen!.id).toLocaleString("en-US")}/{per}
            </SubmitButton>
          )}
        </form>
      )}
    </div>
  );
}
