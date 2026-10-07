"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";
import type { NavBadges, Role } from "./nav-config";

/** Cookie the dashboard layout reads, so the menu loads at the chosen width. */
export const SIDEBAR_COOKIE = "aibos_sidebar";

export function Sidebar({
  role,
  userName,
  email,
  companyName,
  isPlatformAdmin = false,
  hiddenHrefs,
  lockedHrefs,
  badges,
  initialCollapsed = false,
}: {
  role: Role;
  userName: string;
  email: string;
  companyName: string;
  isPlatformAdmin?: boolean;
  hiddenHrefs?: string[];
  lockedHrefs?: string[];
  badges?: NavBadges;
  /** From the cookie: the menu was shrunk to icons last time. */
  initialCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      className={cn(
        "relative z-30 hidden shrink-0 flex-col border-r border-white/[0.09] transition-[width] duration-200 ease-out sm:flex light:border-white/80 glass-panel",
        collapsed ? "w-[4.5rem]" : "w-64"
      )}
    >
      <div className={cn("flex h-16 items-center", collapsed ? "justify-center px-2" : "px-5")}>
        <Link href="/dashboard" aria-label="AIBOS dashboard" className="flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          {collapsed ? <Image src="/logo-mark.png" alt="" width={40} height={40} className="-m-1" /> : <Logo />}
        </Link>
      </div>
      <NavLinks
        role={role}
        isPlatformAdmin={isPlatformAdmin}
        hiddenHrefs={hiddenHrefs}
        lockedHrefs={lockedHrefs}
        badges={badges}
        flyout
        collapsed={collapsed}
      />
      <div className={cn("flex gap-1 border-t border-white/[0.06] p-3 light:border-slate-200", collapsed ? "flex-col items-center px-2" : "items-center")}>
        <div className={collapsed ? "" : "min-w-0 flex-1"}>
          <UserMenu userName={userName} email={email} role={role} companyName={companyName} compact={collapsed} />
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Show the full menu" : "Shrink the menu to icons"}
          title={collapsed ? "Show the full menu" : "Shrink the menu to icons"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 light:text-slate-500 light:hover:bg-slate-900/5 light:hover:text-slate-900"
        >
          <ToggleIcon className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
