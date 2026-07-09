"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems, type Role } from "./nav-config";

export function NavLinks({
  role,
  isPlatformAdmin = false,
  onNavigate,
}: {
  role: Role;
  isPlatformAdmin?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = navItems.filter((item) => {
    if (item.platformAdminOnly) return isPlatformAdmin;
    return !item.roles || item.roles.includes(role);
  });

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
                ? "bg-blue-500/10 text-blue-400"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-50 light:text-slate-500 light:hover:bg-slate-100 light:hover:text-slate-900"
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-blue-500" />
            )}
            <item.icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300 light:text-slate-400 light:group-hover:text-slate-600"
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
