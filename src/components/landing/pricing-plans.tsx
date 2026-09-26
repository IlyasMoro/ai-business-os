"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { aboutRand, EXTRA_USER_PRICE, MAX_SCALE_USERS, PLANS } from "@/lib/plans";

type Cycle = "monthly" | "yearly";

/** The three plan cards with a monthly / yearly switch. Growth is highlighted. */
export function PricingPlans() {
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <div>
      <div className="flex justify-center">
        <div role="group" aria-label="Billing period" className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur-xl">
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cycle === c}
              onClick={() => setCycle(c)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                cycle === c ? "bg-white text-[#0a1428]" : "text-slate-300 hover:text-white"
              }`}
            >
              {c === "monthly" ? "Monthly" : "Yearly"}
              {c === "yearly" && (
                <span className={`ml-1.5 text-xs ${cycle === c ? "text-emerald-700" : "text-emerald-300"}`}>2 months free</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3 md:gap-4 md:items-stretch lg:gap-6">
        {PLANS.map((plan) => {
          const perMonth = cycle === "monthly" ? plan.monthly : Math.round(plan.yearly / 12);
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col overflow-hidden rounded-3xl border p-8 backdrop-blur-xl md:p-6 lg:p-8 ${
                plan.popular ? "border-blue-400/40 bg-blue-500/[0.07] md:-my-3 md:py-9 lg:py-11" : "border-white/10 bg-white/[0.03]"
              }`}
            >
              {plan.popular && (
                <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-56 w-80 -translate-x-1/2 rounded-full bg-blue-600/25 blur-[90px]" />
              )}

              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
                  {plan.popular && (
                    <span className="rounded-full bg-blue-500/20 px-2.5 py-1 text-xs font-semibold text-blue-200">Most popular</span>
                  )}
                </div>
                <p className="mt-2 min-h-[2.5rem] text-sm text-slate-400">{plan.tagline}</p>

                <p className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-5xl font-semibold tracking-tight text-white">${perMonth}</span>
                  <span className="text-slate-400">/ month</span>
                </p>
                <p className="mt-1.5 text-xs text-slate-400">
                  {cycle === "yearly" ? `Billed $${plan.yearly.toLocaleString("en-US")} a year` : "Billed monthly"}
                  {/* A Rand guide so South African buyers needn't convert. */}
                  <span className="text-slate-500"> · {aboutRand(perMonth)} a month</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">Extra users ${EXTRA_USER_PRICE} each a month</p>

                <LinkButton
                  href="/register"
                  variant="glass"
                  size="lg"
                  className={`mt-7 w-full rounded-full ${
                    plan.popular
                      ? "border-transparent bg-white text-[#0a1428] shadow-lg shadow-black/40 hover:bg-blue-50 hover:shadow-xl"
                      : ""
                  }`}
                >
                  Start your free trial
                </LinkButton>
              </div>

              <div className="relative mt-8 border-t border-white/10 pt-7">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{plan.includesLabel}</p>
                <ul className="mt-4 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-slate-200">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
                        <Check aria-hidden className="h-3 w-3 text-emerald-300" />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-slate-400">
        Every plan starts with 14 days free, with every module and no credit card needed.
        <br />
        More than {MAX_SCALE_USERS} users or special needs? Ask us about an Enterprise plan.
        <br />
        <span className="text-xs text-slate-500">Rand amounts are a guide. You are billed in US dollars.</span>
      </p>
    </div>
  );
}
