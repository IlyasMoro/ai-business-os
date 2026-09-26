import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CompanyStatusBadge } from "@/components/layout/company-status-badge";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import type { Role } from "@/components/layout/nav-config";
import type { Notification } from "@/lib/notifications";

export function Topbar({
  companyName,
  userName,
  role,
  isPlatformAdmin = false,
  hiddenHrefs,
  notifications,
  subscription,
  branch,
}: {
  companyName: string;
  userName: string;
  role: Role;
  isPlatformAdmin?: boolean;
  hiddenHrefs?: string[];
  notifications: Notification[];
  subscription: { status: string; trialEndsAt: Date | null; cancelAtPeriodEnd: boolean } | null;
  branch: { options: { id: string; name: string; code: string }[]; currentId: string | null; locked: boolean };
}) {
  return (
    <header className="relative z-30 flex h-16 items-center justify-between border-b border-white/[0.09] px-4 sm:px-6 light:border-white/80 glass-panel">
      <div className="flex items-center gap-3">
        <MobileNav role={role} userName={userName} isPlatformAdmin={isPlatformAdmin} hiddenHrefs={hiddenHrefs} />
        <CompanyStatusBadge companyName={companyName} subscription={subscription} />
        <BranchSwitcher branches={branch.options} currentId={branch.currentId} locked={branch.locked} />
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <NotificationBell notifications={notifications} />
      </div>
    </header>
  );
}
