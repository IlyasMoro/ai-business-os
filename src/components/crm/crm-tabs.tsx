import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/crm", label: "Customers" },
  { href: "/dashboard/crm/deals", label: "Deals" },
  { href: "/dashboard/crm/reminders", label: "Reminders" },
  { href: "/dashboard/crm/report", label: "Sales report" },
] as const;

/** The CRM's views: customers, the deals pipeline, reminders and the sales report. */
export function CrmTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="CRM" className="mt-4 flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_rgb(255_255_255/0.08)] light:shadow-[inset_0_-1px_0_rgb(226_232_240)]">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === active ? "page" : undefined}
          className={cn(
            "whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
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
