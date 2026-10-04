import Link from "next/link";
import { verifySession, hasRole } from "@/lib/dal";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/crm", label: "Customers", adminOnly: false },
  { href: "/dashboard/crm/deals", label: "Deals", adminOnly: false },
  { href: "/dashboard/crm/reminders", label: "Reminders", adminOnly: false },
  { href: "/dashboard/crm/sequences", label: "Sequences", adminOnly: false },
  { href: "/dashboard/crm/report", label: "Sales report", adminOnly: false },
  { href: "/dashboard/crm/settings", label: "Settings", adminOnly: true },
] as const;

export type CrmTab = (typeof TABS)[number]["href"];

/** The CRM's views. Settings shows for owners and admins only. */
export async function CrmTabs({ active }: { active: CrmTab }) {
  const session = await verifySession();
  const isAdmin = hasRole(session, ["OWNER", "ADMIN"]);
  return (
    <nav aria-label="CRM" className="mt-4 flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_rgb(255_255_255/0.08)] light:shadow-[inset_0_-1px_0_rgb(226_232_240)]">
      {TABS.filter((tab) => isAdmin || !tab.adminOnly).map((tab) => (
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
