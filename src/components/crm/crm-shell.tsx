"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/crm", label: "Customers", adminOnly: false },
  { href: "/dashboard/crm/deals", label: "Deals", adminOnly: false },
  { href: "/dashboard/crm/reminders", label: "Reminders", adminOnly: false },
  { href: "/dashboard/crm/sequences", label: "Sequences", adminOnly: false },
  { href: "/dashboard/crm/rules", label: "Rules", adminOnly: true },
  { href: "/dashboard/crm/report", label: "Sales report", adminOnly: false },
  { href: "/dashboard/crm/settings", label: "Settings", adminOnly: true },
] as const;

const TAB_PATHS: readonly string[] = TABS.map((t) => t.href);

/**
 * The CRM's heading and tabs, kept by the CRM layout so they stay put while
 * you move between views: only the content below changes (with its own
 * loading placeholder), and the underline moves the moment you click.
 * Pages for one record (a customer, a deal) have no tabs and show as they are.
 * Rules and Settings show for owners and admins only.
 */
export function CrmShell({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  if (!TAB_PATHS.includes(pathname)) return <>{children}</>;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">CRM</h1>
      <nav
        aria-label="CRM"
        className="mt-3 flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_rgb(255_255_255/0.08)] light:shadow-[inset_0_-1px_0_rgb(226_232_240)]"
      >
        {TABS.filter((tab) => isAdmin || !tab.adminOnly).map((tab) => {
          const active = tab.href === pathname;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
                active
                  ? "border-blue-500 font-medium text-slate-50 light:text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-200 light:text-slate-500 light:hover:text-slate-800"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-5">{children}</div>
    </div>
  );
}
