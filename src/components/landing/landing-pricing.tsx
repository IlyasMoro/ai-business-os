import Link from "next/link";
import { Building2, Check, Users } from "lucide-react";
import { EVERY_PLAN_INCLUDES, PLANS, aboutRand } from "@/lib/plans";
import { cn } from "@/lib/utils";
import styles from "@/components/landing/landing.module.css";

/* The landing page pricing preview: the three plans at their monthly price
   with each one's user and branch allowance, read straight from lib/plans.ts
   so they always match the pricing page, then everything every plan
   includes. The full comparison stays on /pricing. */

/** "Up to 10 users" from "Up to 10 users with owner, admin and employee roles". */
function usersLine(features: string[]) {
  return features.find((f) => /\busers\b/.test(f))?.match(/^Up to [\d,]+ users/)?.[0];
}

function branchesLine(features: string[]) {
  return features.find((f) => /^(\d+|Up to \d+|Unlimited) branch/.test(f));
}

export function LandingPricing() {
  return (
    <>
      <div className={styles.prices}>
        {PLANS.map((plan) => {
          const users = usersLine(plan.features);
          const branches = branchesLine(plan.features);
          return (
            <div key={plan.id} className={cn(styles.price, plan.popular && cn(styles.glass, styles.priceFeat))}>
              <p className={styles.priceBadge}>{plan.popular ? "Most popular" : ""}</p>
              <h3 className={styles.priceName}>{plan.name}</h3>
              <p className={styles.priceTag}>{plan.tagline}</p>
              <p className={styles.priceAmt}>
                ${plan.monthly}
                <span> /month</span>
              </p>
              <p className={styles.priceRand}>{aboutRand(plan.monthly)} a month</p>
              <div className={styles.priceLimits}>
                {users && (
                  <p className={styles.priceLimit}>
                    <Users aria-hidden />
                    {users}
                  </p>
                )}
                {branches && (
                  <p className={styles.priceLimit}>
                    <Building2 aria-hidden />
                    {branches}
                  </p>
                )}
              </div>
              <Link href="/register" className={plan.popular ? styles.btn : styles.btnDark}>
                Start free trial
              </Link>
            </div>
          );
        })}
      </div>

      {/* Connector: three drops from the plan cards merging into one arrow
          at the shared "Every plan includes" panel, the same device as StockPilot's
          landing. Hidden once the cards stop sitting three up. */}
      <div className={styles.merge} aria-hidden>
        <svg viewBox="0 0 760 58" preserveAspectRatio="none">
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.3" strokeLinecap="round">
            <path vectorEffect="non-scaling-stroke" d="M127 2 V16 Q127 26 139 26 H380" />
            <path vectorEffect="non-scaling-stroke" d="M633 2 V16 Q633 26 621 26 H380" />
            <path vectorEffect="non-scaling-stroke" d="M380 2 V42" />
          </g>
          <path d="M376 40 L380 52 L384 40 Z" fill="currentColor" fillOpacity="0.4" />
        </svg>
      </div>

      <div className={styles.incl}>
        <p className={styles.inclHead}>Every plan includes</p>
        <div className={styles.inclGrid}>
          {EVERY_PLAN_INCLUDES.map((item) => (
            <div key={item} className={styles.inclRow}>
              <span className={styles.tick} aria-hidden>
                <Check />
              </span>
              <span className={styles.inclT}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.compare}>
        <Link href="/pricing" className={styles.compareLink}>
          Compare every feature by plan
        </Link>
      </div>
    </>
  );
}
