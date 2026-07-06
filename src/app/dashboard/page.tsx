import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { getBusinessSnapshot } from "@/lib/business-snapshot";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import {
  Users,
  ShoppingCart,
  Boxes,
  Receipt,
  LifeBuoy,
  FolderKanban,
} from "lucide-react";

export default async function DashboardOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getCurrentUser();
  const snapshot = await getBusinessSnapshot(user.companyId);

  const stats = [
    {
      label: "Total customers",
      value: snapshot.customerCount,
      href: "/dashboard/crm",
      icon: Users,
      alert: false,
    },
    {
      label: "Open orders",
      value: snapshot.openOrderCount,
      href: "/dashboard/sales",
      icon: ShoppingCart,
      alert: false,
    },
    {
      label: "Products low on stock",
      value: snapshot.lowStockCount,
      href: "/dashboard/inventory",
      icon: Boxes,
      alert: snapshot.lowStockCount > 0,
    },
    {
      label: "Outstanding invoices",
      value: snapshot.outstandingInvoiceCount,
      href: "/dashboard/invoicing",
      icon: Receipt,
      alert: snapshot.outstandingInvoiceCount > 0,
    },
    {
      label: "Open support tickets",
      value: snapshot.openTicketCount,
      href: "/dashboard/support",
      icon: LifeBuoy,
      alert: snapshot.openTicketCount > 0,
    },
    {
      label: "Active projects",
      value: snapshot.activeProjectCount,
      href: "/dashboard/projects",
      icon: FolderKanban,
      alert: false,
    },
  ];

  return (
    <div>
      <ErrorBanner code={error} />
      <h1 className="text-2xl font-semibold text-slate-900">
        Welcome back, {user.name.split(" ")[0]}
      </h1>
      <p className="mt-1 text-slate-500">
        Here&apos;s what&apos;s happening at {user.company.name}.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="group p-5 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">{stat.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">
                    {stat.value}
                  </p>
                </div>
                <span
                  className={
                    stat.alert
                      ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700"
                      : "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100"
                  }
                >
                  <stat.icon className="h-5 w-5" />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
