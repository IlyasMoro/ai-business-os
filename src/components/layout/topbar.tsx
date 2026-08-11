import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CompanyStatusBadge } from "@/components/layout/company-status-badge";
import type { Role } from "@/components/layout/nav-config";
import type { Notification } from "@/lib/notifications";

export function Topbar({
  companyName,
  userName,
  role,
  isPlatformAdmin = false,
  notifications,
  subscription,
}: {
  companyName: string;
  userName: string;
  role: Role;
  isPlatformAdmin?: boolean;
  notifications: Notification[];
  subscription: { status: string; trialEndsAt: Date | null; cancelAtPeriodEnd: boolean } | null;
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-white/[0.06] bg-black px-4 sm:px-6 light:border-slate-200 light:bg-white">
      <div className="flex items-center gap-3">
        <MobileNav role={role} userName={userName} isPlatformAdmin={isPlatformAdmin} />
        <CompanyStatusBadge companyName={companyName} subscription={subscription} />
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <NotificationBell notifications={notifications} />
      </div>
    </header>
  );
}
