import { logout } from "@/lib/actions/auth";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PulseClock } from "@/components/dash-viz/pulse-clock";
import type { Role } from "@/components/layout/nav-config";
import type { Notification } from "@/lib/notifications";
import { LogOut } from "lucide-react";

export function Topbar({
  companyName,
  userName,
  role,
  isPlatformAdmin = false,
  notifications,
}: {
  companyName: string;
  userName: string;
  role: Role;
  isPlatformAdmin?: boolean;
  notifications: Notification[];
}) {
  const initial = userName.trim().charAt(0).toUpperCase() || "?";

  return (
    <header className="flex h-16 items-center justify-between border-b border-white/[0.06] bg-black px-4 sm:px-6 light:border-slate-200 light:bg-white">
      <div className="flex items-center gap-3">
        <MobileNav role={role} isPlatformAdmin={isPlatformAdmin} />
        <p className="text-sm font-semibold text-slate-50 light:text-slate-900">{companyName}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:block">
          <PulseClock />
        </div>
        <div className="mx-1 hidden h-6 w-px bg-white/[0.06] sm:block light:bg-slate-200" />
        <ThemeToggle />
        <NotificationBell notifications={notifications} />
        <div className="hidden items-center gap-2.5 sm:flex">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/20 text-xs font-semibold text-amber-400">
            {initial}
          </span>
          <span className="text-sm text-slate-300 light:text-slate-600">{userName}</span>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-400 transition-colors duration-150 hover:bg-white/5 hover:text-slate-50 light:text-slate-500 light:hover:bg-slate-100 light:hover:text-slate-900"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
