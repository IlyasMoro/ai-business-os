import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { CUSTOM_PLAN, PLAN_MATRIX, LISTED_PLANS, type PlanCell } from "@/lib/plans";
import { cn } from "@/lib/utils";
import styles from "@/components/landing/landing.module.css";

/* Every feature by plan, side by side: Starter, Growth, then Enterprise.
   Rows come from PLAN_MATRIX in lib/plans.ts, so the table and the plan
   cards read the same source. Growth's column is tinted to match its
   highlighted card. */

function Cell({ value }: { value: PlanCell }) {
  if (value === true) {
    return (
      <span className={cn(styles.planTick, "mx-auto")}>
        <Check aria-hidden />
        <span className="sr-only">Included</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus aria-hidden className="mx-auto h-4 w-4 text-[#c3ccd8]" />
        <span className="sr-only">Not included</span>
      </>
    );
  }
  return <span className="text-[13px] font-bold text-[#0b1f5e] sm:text-sm">{value}</span>;
}

const growthCol = "bg-[#f0f9fc]";

export function PricingCompare() {
  return (
    // The plans on sale as columns: on narrow screens the table scrolls
    // sideways inside its card instead of squeezing the columns.
    <div className="overflow-x-auto border border-[#d5dce5] bg-white shadow-[0_18px_38px_-26px_rgba(24,67,111,0.45)]">
      <table className="w-full min-w-[560px] table-fixed border-collapse text-left">
        <caption className="sr-only">Every feature by plan</caption>
        <colgroup>
          <col className="w-[30%]" />
          {LISTED_PLANS.map((plan) => (
            <col key={plan.id} />
          ))}
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="px-3 py-5 align-bottom sm:px-6">
              <span className="sr-only">Feature</span>
            </th>
            {LISTED_PLANS.map((plan) => (
              <th key={plan.id} scope="col" className={cn("px-1.5 pb-5 pt-6 text-center align-bottom sm:px-3", plan.popular && growthCol)}>
                {plan.popular && (
                  <span className="mb-2 hidden rounded-full bg-cyan-400 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#0a1428] sm:inline-block">
                    Most popular
                  </span>
                )}
                <span className="block text-xs font-extrabold uppercase tracking-[0.06em] text-[#0b1f5e] sm:text-sm">
                  {plan.name}
                </span>
                <span className="mt-1 block text-lg font-extrabold text-[#0b1f5e] sm:text-2xl">
                  ${plan.monthly.toLocaleString("en-US")}
                  {/* On phones "/mo" drops below the price so the three columns fit. */}
                  <span className="block text-[11px] font-semibold text-[#8a93a3] sm:inline sm:text-xs"> /mo</span>
                </span>
                {/* The wrapper hides it on phones: the button class sets its
                    own display, which would beat a utility on the link. */}
                <span className="mt-3 hidden sm:block">
                  <Link href="/register" className={cn(plan.popular ? styles.btn : styles.btnDark, "px-4 py-2 text-[11px]")}>
                    Start trial
                  </Link>
                </span>
              </th>
            ))}
            {/* Enterprise is built by the client: a starting price, and a link to the builder. */}
            <th scope="col" className="px-1.5 pb-5 pt-6 text-center align-bottom sm:px-3">
              <span className="block text-xs font-extrabold uppercase tracking-[0.06em] text-[#0b1f5e] sm:text-sm">
                {CUSTOM_PLAN.name}
              </span>
              <span className="mt-1 block text-lg font-extrabold text-[#0b1f5e] sm:text-2xl">
                {CUSTOM_PLAN.priceLabel}
                <span className="block text-[11px] font-semibold text-[#8a93a3] sm:inline sm:text-xs"> /mo</span>
              </span>
              <span className="mt-3 hidden sm:block">
                <a href="#enterprise" className={cn(styles.btnDark, "px-4 py-2 text-[11px]")}>
                  Build yours
                </a>
              </span>
            </th>
          </tr>
        </thead>

        {PLAN_MATRIX.map((group) => (
          <tbody key={group.title}>
            <tr>
              <th scope="colgroup" colSpan={LISTED_PLANS.length + 2} className="bg-[#0b0f17] px-3 py-3 text-xs font-extrabold uppercase tracking-[0.06em] text-cyan-400 sm:px-6">
                {group.title}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.label} className="border-t border-[#e6e9ee]">
                <th scope="row" className="px-3 py-3.5 text-[13px] font-semibold leading-snug text-[#3b4a63] sm:px-6 sm:text-sm">
                  {row.label}
                </th>
                {row.values.map((value, i) => (
                  <td key={i} className={cn("px-1.5 py-3.5 text-center align-middle sm:px-3", LISTED_PLANS[i]?.popular && growthCol)}>
                    <Cell value={value} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
