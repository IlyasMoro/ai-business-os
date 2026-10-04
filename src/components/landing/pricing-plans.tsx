"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { aboutRand, CUSTOM_PLAN, LISTED_PLANS, salesMailto } from "@/lib/plans";
import { EnterpriseBuilder } from "@/components/billing/enterprise-builder";
import { cn } from "@/lib/utils";
import styles from "@/components/landing/landing.module.css";

type Cycle = "monthly" | "yearly";

/** Starter and Growth with a monthly / yearly switch, then Enterprise with
 * a builder that prices users, branches and add ons as you go. White cards
 * on the white page, with Growth in dark glass so the eye lands on it first. */
export function PricingPlans() {
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <div>
      <div className="flex justify-center">
        <div role="group" aria-label="Billing period" className={cn(styles.glass, styles.navPill, "inline-flex")}>
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cycle === c}
              onClick={() => setCycle(c)}
              className={cn(styles.navLink, cycle === c && styles.cycleOn)}
            >
              {c === "monthly" ? "Monthly" : "Yearly"}
              {c === "yearly" && <span className={styles.cycleSave}>2 months free</span>}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.plans}>
        {LISTED_PLANS.map((plan) => {
          const perMonth = cycle === "monthly" ? plan.monthly : Math.round(plan.yearly / 12);
          return (
            <div key={plan.id} className={cn(styles.plan, plan.popular && cn(styles.glass, styles.planFeat))}>
              <div className={styles.planHead}>
                <h2 className={styles.planName}>{plan.name}</h2>
                {plan.popular && <span className={styles.planBadge}>Most popular</span>}
              </div>
              <p className={styles.planTag}>{plan.tagline}</p>

              <p className={styles.planAmt}>
                ${perMonth.toLocaleString("en-US")}
                <span> / month</span>
              </p>
              <p className={styles.planNote}>
                {cycle === "yearly" ? `Billed $${plan.yearly.toLocaleString("en-US")} a year` : "Billed monthly"}
                {/* A Rand guide so South African buyers needn't convert. */}
                {" · "}
                {aboutRand(perMonth)} a month
              </p>

              <Link href="/register" className={cn(plan.popular ? styles.btn : styles.btnDark, styles.planBtn)}>
                Start free trial
              </Link>

              <div className={styles.planList}>
                <p className={styles.planListHead}>{plan.includesLabel}</p>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <span className={styles.planTick} aria-hidden>
                        <Check />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}

        <div id="enterprise" className={cn(styles.plan, "scroll-mt-28")}>
          <div className={styles.planHead}>
            <h2 className={styles.planName}>{CUSTOM_PLAN.name}</h2>
          </div>
          <p className={styles.planTag}>{CUSTOM_PLAN.tagline}</p>

          <p className={styles.planAmt}>{CUSTOM_PLAN.priceLabel}</p>
          <p className={styles.planNote}>{CUSTOM_PLAN.priceNote}</p>

          <div className="mt-5">
            <EnterpriseBuilder tone="landing" interval={cycle}>
              {/* A column, so the button stretches like the other cards'. */}
              <div className="flex flex-col">
                <Link href="/register" className={cn(styles.btnDark, styles.planBtn)}>
                  Start free trial
                </Link>
              </div>
              <p className="text-center text-xs text-[#6b7686]">
                Buy it on Billing once you&apos;re in.
                {salesMailto() && (
                  <>
                    {" "}Contracts, invoicing or more users?{" "}
                    <a href={salesMailto()!} className="font-semibold text-[#0b1f5e] underline">
                      Talk to us
                    </a>
                  </>
                )}
              </p>
            </EnterpriseBuilder>
          </div>

          <div className={styles.planList}>
            <p className={styles.planListHead}>{CUSTOM_PLAN.includesLabel}</p>
            <ul>
              {CUSTOM_PLAN.features.map((feature) => (
                <li key={feature}>
                  <span className={styles.planTick} aria-hidden>
                    <Check />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className={styles.planFine}>
        <p className={styles.planFineSmall}>Rand amounts are a guide. You are billed in US dollars.</p>
      </div>
    </div>
  );
}
