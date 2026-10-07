import { cookies, headers } from "next/headers";
import { getCurrentUser, verifySession } from "@/lib/dal";
import { hiddenByRole } from "@/lib/company-roles";
import { db } from "@/lib/db";
import { getNotifications } from "@/lib/notifications";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { checkSubscriptionAccess } from "@/lib/subscription-access";
import { getReturnPolicy } from "@/lib/returns-policy";
import { getMrpSettings } from "@/lib/mrp";
import { getEdiSettings } from "@/lib/edi/settings";
import { getControllingSettings } from "@/lib/controlling";
import { getBranchContext } from "@/lib/branches";
import { getCompanyPlan } from "@/lib/plan-limits";
import { FEATURE_MIN_PLAN, planAllows, type PlanFeature } from "@/lib/plans";
import { Sidebar, SIDEBAR_COOKIE } from "@/components/layout/sidebar";
import { getNavBadges } from "@/lib/nav-badges";
import { Topbar } from "@/components/layout/topbar";
import { SubscriptionBlocked } from "@/components/billing/subscription-blocked";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const [notifications, subscription, returnPolicy, mrpSettings, ediSettings, controlling, branchCtx, plan, logoRows] = await Promise.all([
    getNotifications(user.companyId),
    db.subscription.findUnique({ where: { companyId: user.companyId } }),
    getReturnPolicy(user.companyId),
    getMrpSettings(user.companyId),
    getEdiSettings(user.companyId),
    getControllingSettings(user.companyId),
    getBranchContext(),
    getCompanyPlan(user.companyId),
    // The logo's size only, as a cache version; the image itself loads from /api/company-logo.
    db.$queryRaw<{ size: number | null }[]>`SELECT octet_length("logoData") AS size FROM "Company" WHERE id = ${user.companyId}`,
  ]);
  const logoSize = logoRows[0]?.size ?? null;
  const logoUrl = logoSize ? `/api/company-logo/${user.companyId}?v=${logoSize}` : null;
  // Modules a company role can't open are left out of the menu and search.
  const { access: roleAccess } = await verifySession();
  const hiddenHrefs = [
    ...hiddenByRole(roleAccess),
    ...(returnPolicy.enabled ? [] : ["/dashboard/returns"]),
    ...(mrpSettings.enabled ? [] : ["/dashboard/mrp"]),
    // Unset EDI stays visible so it can be set up; only an explicit off hides it.
    ...(ediSettings && !ediSettings.enabled ? ["/dashboard/edi"] : []),
    ...(controlling.enabled ? [] : ["/dashboard/controlling"]),
    // Transfers only make sense once there is somewhere to move stock to.
    ...(branchCtx.branches.filter((b) => b.active).length > 1 ? [] : ["/dashboard/transfers"]),
  ];
  // Modules a plan lacks stay in the menu, labelled with the plan that has them.
  const lockedHrefs = (Object.keys(FEATURE_MIN_PLAN) as PlanFeature[])
    .filter((feature) => !planAllows(plan, feature))
    .map((feature) => `/dashboard/${feature}`);
  const platformAdmin = isPlatformAdmin(user.email);
  const [badges, cookieStore] = await Promise.all([getNavBadges(user.companyId, branchCtx.viewBranchId), cookies()]);
  const sidebarCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed";

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const onBillingPage = pathname.startsWith("/dashboard/billing");
  const access = onBillingPage ? { blocked: false as const } : await checkSubscriptionAccess(user.companyId);

  return (
    <div className="app-text flex min-h-screen">
      <Sidebar
        role={user.role}
        userName={user.name}
        email={user.email}
        companyName={user.company.name}
        isPlatformAdmin={platformAdmin}
        hiddenHrefs={hiddenHrefs}
        lockedHrefs={lockedHrefs}
        badges={badges}
        initialCollapsed={sidebarCollapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          companyName={user.company.name}
          userName={user.name}
          email={user.email}
          role={user.role}
          isPlatformAdmin={platformAdmin}
          hiddenHrefs={hiddenHrefs}
          lockedHrefs={lockedHrefs}
          badges={badges}
          notifications={notifications}
          subscription={subscription}
          planName={plan.name}
          logoUrl={logoUrl}
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
