import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/crm", label: "Customers" },
  { href: "/dashboard/crm/deals", label: "Deals" },
  { href: "/dashboard/crm/reminders", label: "Reminders" },
] as const;

/** The CRM's three views: customers, the deals pipeline and reminders. */
export function CrmTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="CRM" className="mt-4 flex gap-1 border-b border-white/[0.08] light:border-slate-200">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
            tab.href === active
              ? "border-blue-500 font-medium text-slate-50 light:text-slate-900"
              : "border-transparent text-slate-400 hover:text-slate-200 light:text-slate-500 light:hover:text-slate-800"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
