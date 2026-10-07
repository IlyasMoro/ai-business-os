import Link from "next/link";
import { navSettings, type Role } from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";

/** Tabs across the top of every company settings page (Company, Modules,
 * Branches, Team and roles, Integrations, Plan and billing), so the
 * settings live in one place instead of the everyday menu. Scrolls sideways
 * on a phone. */
export function SettingsTabs({ role, current }: { role: Role; current: string }) {
  const tabs = navSettings.filter((t) => !t.roles || t.roles.includes(role));
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Settings</p>
      <nav aria-label="Settings" className="-mx-4 mt-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-white/[0.08] light:border-slate-200">
          {tabs.map((tab) => {
            const active = tab.href === current;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
                    active
                      ? "border-blue-500 font-medium text-white light:text-slate-900"
                      : "border-transparent text-slate-400 hover:text-slate-100 light:text-slate-500 light:hover:text-slate-900",
                  )}
                >
                  <tab.icon className={cn("h-4 w-4", active ? "text-blue-400 light:text-blue-600" : "")} />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
