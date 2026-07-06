import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import {
  Users,
  ShoppingCart,
  Boxes,
  Receipt,
  LifeBuoy,
  FolderKanban,
} from "lucide-react";

export default async function DashboardOverviewPage() {
  const user = await getCurrentUser();
  const companyId = user.companyId;

  const [
    customerCount,
    openOrderCount,
    products,
    outstandingInvoiceCount,
    openTicketCount,
    activeProjectCount,
  ] = await Promise.all([
    db.customer.count({ where: { companyId } }),
    db.order.count({ where: { companyId, status: { in: ["PENDING", "CONFIRMED"] } } }),
    db.product.findMany({ where: { companyId }, select: { stockQty: true, reorderLevel: true } }),
    db.invoice.count({ where: { companyId, status: { in: ["SENT", "OVERDUE"] } } }),
    db.ticket.count({ where: { companyId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.project.count({ where: { companyId, status: "ACTIVE" } }),
  ]);

  const lowStockCount = products.filter((p) => p.stockQty <= p.reorderLevel).length;

  const stats = [
    {
      label: "Total customers",
      value: customerCount,
      href: "/dashboard/crm",
      icon: Users,
      alert: false,
    },
    {
      label: "Open orders",
      value: openOrderCount,
      href: "/dashboard/sales",
      icon: ShoppingCart,
      alert: false,
    },
    {
      label: "Products low on stock",
      value: lowStockCount,
      href: "/dashboard/inventory",
      icon: Boxes,
      alert: lowStockCount > 0,
    },
    {
      label: "Outstanding invoices",
      value: outstandingInvoiceCount,
      href: "/dashboard/invoicing",
      icon: Receipt,
      alert: outstandingInvoiceCount > 0,
    },
    {
      label: "Open support tickets",
      value: openTicketCount,
      href: "/dashboard/support",
      icon: LifeBuoy,
      alert: openTicketCount > 0,
    },
    {
      label: "Active projects",
      value: activeProjectCount,
      href: "/dashboard/projects",
      icon: FolderKanban,
      alert: false,
    },
  ];

  return (
    <div>
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
