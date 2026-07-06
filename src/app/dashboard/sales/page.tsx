import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Plus } from "lucide-react";

const statusTone = {
  PENDING: "yellow",
  CONFIRMED: "blue",
  FULFILLED: "green",
  CANCELLED: "red",
} as const;

export default async function SalesPage() {
  const session = await verifySession();

  const orders = await db.order.findMany({
    where: { companyId: session.companyId },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sales</h1>
          <p className="mt-1 text-sm text-slate-500">
            {orders.length} order{orders.length === 1 ? "" : "s"}
          </p>
        </div>
        <LinkButton href="/dashboard/sales/new">
          <Plus className="h-4 w-4" />
          New order
        </LinkButton>
      </div>

      <Card className="mt-6">
        {orders.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No orders yet. Create your first one to get started.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/sales/${order.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {order.customer.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone[order.status]}>{order.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-600">${order.totalAmount.toFixed(2)}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {order.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
