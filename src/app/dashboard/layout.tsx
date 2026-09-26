import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { getNotifications } from "@/lib/notifications";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { checkSubscriptionAccess } from "@/lib/subscription-access";
import { getReturnPolicy } from "@/lib/returns-policy";
import { getMrpSettings } from "@/lib/mrp";
import { getEdiSettings } from "@/lib/edi/settings";
import { getControllingSettings } from "@/lib/controlling";
import { getBranchContext } from "@/lib/branches";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SubscriptionBlocked } from "@/components/billing/subscription-blocked";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const [notifications, subscription, returnPolicy, mrpSettings, ediSettings, controlling, branchCtx] = await Promise.all([
    getNotifications(user.companyId),
    db.subscription.findUnique({ where: { companyId: user.companyId } }),
    getReturnPolicy(user.companyId),
    getMrpSettings(user.companyId),
    getEdiSettings(user.companyId),
    getControllingSettings(user.companyId),
    getBranchContext(),
  ]);
  const hiddenHrefs = [
    ...(returnPolicy.enabled ? [] : ["/dashboard/returns"]),
    ...(mrpSettings.enabled ? [] : ["/dashboard/mrp"]),
    // Unset EDI stays visible so it can be set up; only an explicit off hides it.
    ...(ediSettings && !ediSettings.enabled ? ["/dashboard/edi"] : []),
    ...(controlling.enabled ? [] : ["/dashboard/controlling"]),
  ];
  const platformAdmin = isPlatformAdmin(user.email);

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const onBillingPage = pathname.startsWith("/dashboard/billing");
  const access = onBillingPage ? { blocked: false as const } : await checkSubscriptionAccess(user.companyId);

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} userName={user.name} isPlatformAdmin={platformAdmin} hiddenHrefs={hiddenHrefs} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          companyName={user.company.name}
          userName={user.name}
          role={user.role}
          isPlatformAdmin={platformAdmin}
          hiddenHrefs={hiddenHrefs}
          notifications={notifications}
          subscription={subscription}
          branch={{
            options: branchCtx.branches.filter((b) => b.active || b.id === branchCtx.viewBranchId).map(({ id, name, code }) => ({ id, name, code })),
            currentId: branchCtx.viewBranchId,
            locked: !branchCtx.canSwitch,
          }}
        />
        <main className="page-stage flex-1 overflow-y-auto p-4 sm:p-6">
          {access.blocked ? <SubscriptionBlocked reason={access.reason} /> : children}
        </main>
      </div>
    </div>
  );
}
