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
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-3 backdrop-blur-md light:border-slate-200 light:bg-slate-100/70">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-xs font-semibold text-slate-200 light:bg-white light:text-slate-700">
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
