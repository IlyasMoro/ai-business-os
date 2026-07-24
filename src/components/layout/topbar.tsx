import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import type { Role } from "@/components/layout/nav-config";
import type { Notification } from "@/lib/notifications";

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
  const companyInitial = companyName.trim().charAt(0).toUpperCase() || "?";

  return (
    <header className="flex h-16 items-center justify-between border-b border-white/[0.06] bg-black px-4 sm:px-6 light:border-slate-200 light:bg-white">
      <div className="flex items-center gap-3">
        <MobileNav role={role} isPlatformAdmin={isPlatformAdmin} />
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/20 text-xs font-semibold text-amber-400">
            {companyInitial}
          </span>
          <p className="text-sm font-semibold text-slate-50 light:text-slate-900">{companyName}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <NotificationBell notifications={notifications} />
        <UserMenu userName={userName} />
      </div>
    </header>
  );
}
