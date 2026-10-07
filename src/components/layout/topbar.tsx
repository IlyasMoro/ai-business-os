import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationBell } from "@/components/layout/notification-bell";
import { CompanyStatusBadge } from "@/components/layout/company-status-badge";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import { CommandPalette, SearchButton } from "@/components/layout/command-palette";
import type { NavBadges, Role } from "@/components/layout/nav-config";
import type { Notification } from "@/lib/notifications";

export function Topbar({
  companyName,
  userName,
  email,
  role,
  isPlatformAdmin = false,
  hiddenHrefs,
  lockedHrefs,
  badges,
  notifications,
  subscription,
  planName,
  logoUrl,
  branch,
}: {
  companyName: string;
  userName: string;
  email: string;
  role: Role;
  isPlatformAdmin?: boolean;
  hiddenHrefs?: string[];
  lockedHrefs?: string[];
  badges?: NavBadges;
  notifications: Notification[];
  subscription: { status: string; trialEndsAt: Date | null; currentPeriodEnd: Date | null; cancelAtPeriodEnd: boolean } | null;
  planName: string;
  logoUrl: string | null;
  branch: { options: { id: string; name: string; code: string }[]; currentId: string | null; locked: boolean };
}) {
  return (
    <header className="relative z-30 flex h-16 items-center justify-between gap-2 border-b border-white/[0.09] px-3 sm:px-6 light:border-white/80 glass-panel">
      {/* On a phone the company shows as its logo only and the branch name
          is shortened, so the bar fits a 375 px screen. */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <MobileNav role={role} userName={userName} email={email} companyName={companyName} isPlatformAdmin={isPlatformAdmin} hiddenHrefs={hiddenHrefs} lockedHrefs={lockedHrefs} badges={badges} />
        <CompanyStatusBadge
          companyName={companyName}
          subscription={subscription}
          planName={planName}
          logoUrl={logoUrl}
          canManage={role === "OWNER"}
        />
        <BranchSwitcher branches={branch.options} currentId={branch.currentId} locked={branch.locked} />
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <SearchButton />
        <NotificationBell notifications={notifications} />
      </div>
      <CommandPalette role={role} isPlatformAdmin={isPlatformAdmin} hiddenHrefs={hiddenHrefs} lockedHrefs={lockedHrefs} />
    </header>
  );
}
