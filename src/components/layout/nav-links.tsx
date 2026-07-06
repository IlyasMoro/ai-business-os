"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems, type Role } from "./nav-config";

export function NavLinks({
  role,
  onNavigate,
}: {
  role: Role;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = navItems.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <nav className="flex-1 space-y-0.5 px-3">
      {items.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
              active
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-indigo-600" />
            )}
            <item.icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
