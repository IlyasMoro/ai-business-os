import { Check, Minus } from "lucide-react";
import { navGroups } from "@/components/layout/nav-config";

/* Pricing comparison: AIBOS against running a separate app per department.
   Department rows come from the sidebar config, so the table always lists
   what the product really has. The "separate apps" column stays general and
   fair on purpose: no competitor names and no invented prices. Public copy
   uses no hyphens. */

export const PLAN_DEPARTMENTS = navGroups
  .filter((group) => group.label !== "Workspace")
  .map((group) => ({
    label: group.label,
    icon: group.icon,
    modules: group.items.filter((item) => !item.platformAdminOnly).map((item) => item.label),
  }));

const ACROSS_THE_BUSINESS = [
  { feature: "One sign in for every department", others: "A separate login per app" },
  { feature: "Customers, orders and invoices shared everywhere", others: "Copied or synced between apps" },
  { feature: "AI that reads across every department", others: "Limited to each app's own data" },
  { feature: "Every AI action waits for your approval", others: "Varies by app" },
  { feature: "Unlimited users with owner, admin and employee roles", others: "Usually charged per user" },
  { feature: "Export any list or download a full backup", others: "Varies by app" },
];

function Included() {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15">
        <Check aria-hidden className="h-3 w-3" />
      </span>
      {/* Phones show only the check to keep the column narrow. */}
      <span className="sr-only sm:not-sr-only">Included</span>
    </span>
  );
}

function Others({ children }: { children: string }) {
  return (
    <span className="inline-flex items-start gap-1.5 text-sm text-slate-400">
      <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
      {children}
    </span>
  );
}

const rowClass = "border-t border-white/[0.07]";
const aibosCell = "bg-blue-500/[0.06] px-4 py-4 align-middle sm:px-5";
// On phones the third column is hidden and its text becomes a note under
// each feature, so the table fits the screen instead of scrolling sideways.
const othersCell = "hidden px-5 py-4 align-middle sm:table-cell";

function OthersNote({ children }: { children: string }) {
  return <span className="mt-1.5 block text-xs text-slate-500 sm:hidden">Separate apps: {children}</span>;
}

export function PricingCompare() {
  return (
    <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">AIBOS compared with running a separate app for each department</caption>
        <thead>
          <tr>
            <th scope="col" className="px-5 py-5 text-xs sm:w-[44%] sm:px-6 font-semibold uppercase tracking-[0.14em] text-slate-400">
              What you get
            </th>
            <th scope="col" className="w-24 border-x border-blue-400/20 bg-blue-500/[0.1] px-4 py-5 sm:w-[28%] sm:px-5">
              <span className="block text-base font-semibold text-white">AIBOS</span>
              <span className="mt-0.5 hidden text-xs font-normal text-blue-200/80 sm:block">$49 a month, everything included</span>
            </th>
            <th scope="col" className="hidden px-5 py-5 sm:table-cell">
              <span className="block text-base font-semibold text-slate-300">Separate apps</span>
              <span className="mt-0.5 block text-xs font-normal text-slate-500">One tool per department</span>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr className={rowClass}>
            <th scope="colgroup" colSpan={3} className="px-6 pb-2 pt-6 text-xs font-semibold uppercase tracking-[0.14em] text-blue-400">
              {PLAN_DEPARTMENTS.length} departments
            </th>
          </tr>
          {PLAN_DEPARTMENTS.map((dept) => (
            <tr key={dept.label} className={rowClass}>
              <th scope="row" className="px-5 py-4 font-normal sm:px-6">
                <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-100">
                  <dept.icon aria-hidden className="h-4 w-4 shrink-0 text-blue-400" />
                  {dept.label}
                </span>
                <span className="mt-1 block pl-[1.625rem] text-xs leading-relaxed text-slate-400">
                  {dept.modules.join(" · ")}
                </span>
                <span className="block pl-[1.625rem]">
                  <OthersNote>Usually a separate app</OthersNote>
                </span>
              </th>
              <td className={`${aibosCell} border-x border-blue-400/20`}>
                <Included />
              </td>
              <td className={othersCell}>
                <Others>Usually a separate app</Others>
              </td>
            </tr>
          ))}

          <tr className={rowClass}>
            <th scope="colgroup" colSpan={3} className="px-6 pb-2 pt-8 text-xs font-semibold uppercase tracking-[0.14em] text-blue-400">
              Across the business
            </th>
          </tr>
          {ACROSS_THE_BUSINESS.map((row) => (
            <tr key={row.feature} className={rowClass}>
              <th scope="row" className="px-5 py-4 text-sm font-medium text-slate-100 sm:px-6">
                {row.feature}
                <OthersNote>{row.others}</OthersNote>
              </th>
              <td className={`${aibosCell} border-x border-blue-400/20`}>
                <Included />
              </td>
              <td className={othersCell}>
                <Others>{row.others}</Others>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
