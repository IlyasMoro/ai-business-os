import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/dal";
import { getNotifications } from "@/lib/notifications";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { checkSubscriptionAccess } from "@/lib/subscription-access";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SubscriptionBlocked } from "@/components/billing/subscription-blocked";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const notifications = await getNotifications(user.companyId);
  const platformAdmin = isPlatformAdmin(user.email);

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const onBillingPage = pathname.startsWith("/dashboard/billing");
  const access = onBillingPage ? { blocked: false as const } : await checkSubscriptionAccess(user.companyId);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role={user.role} isPlatformAdmin={platformAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          companyName={user.company.name}
          userName={user.name}
          role={user.role}
          isPlatformAdmin={platformAdmin}
          notifications={notifications}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {access.blocked ? <SubscriptionBlocked reason={access.reason} /> : children}
        </main>
      </div>
    </div>
  );
}
