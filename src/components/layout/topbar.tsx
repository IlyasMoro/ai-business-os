import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationBell } from "@/components/layout/notification-bell";
import { CompanyStatusBadge } from "@/components/layout/company-status-badge";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import { CommandPalette, SearchButton } from "@/components/layout/command-palette";
import type { Role } from "@/components/layout/nav-config";
import type { Notification } from "@/lib/notifications";

export function Topbar({
  companyName,
  userName,
  email,
  role,
  isPlatformAdmin = false,
  hiddenHrefs,
  lockedHrefs,
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
  notifications: Notification[];
  subscription: { status: string; trialEndsAt: Date | null; currentPeriodEnd: Date | null; cancelAtPeriodEnd: boolean } | null;
  planName: string;
  logoUrl: string | null;
  branch: { options: { id: string; name: string; code: string }[]; currentId: string | null; locked: boolean };
}) {
  return (
    <header className="relative z-30 flex h-16 items-center justify-between border-b border-white/[0.09] px-4 sm:px-6 light:border-white/80 glass-panel">
      <div className="flex items-center gap-3">
        <MobileNav role={role} userName={userName} email={email} companyName={companyName} isPlatformAdmin={isPlatformAdmin} hiddenHrefs={hiddenHrefs} lockedHrefs={lockedHrefs} />
        <CompanyStatusBadge
          companyName={companyName}
          subscription={subscription}
          planName={planName}
          logoUrl={logoUrl}
          canManage={role === "OWNER"}
        />
        <BranchSwitcher branches={branch.options} currentId={branch.currentId} locked={branch.locked} />
      </div>
      <div className="flex items-center gap-3">
        <SearchButton />
        <NotificationBell notifications={notifications} />
      </div>
      <CommandPalette role={role} isPlatformAdmin={isPlatformAdmin} hiddenHrefs={hiddenHrefs} />
    </header>
  );
}
