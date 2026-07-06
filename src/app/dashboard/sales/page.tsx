import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { SearchForm } from "@/components/ui/search-form";
import { Pagination } from "@/components/ui/pagination";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { Plus } from "lucide-react";

const statusTone = {
  PENDING: "yellow",
  CONFIRMED: "blue",
  FULFILLED: "green",
  CANCELLED: "red",
} as const;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageParam, q } = await searchParams;
  const page = parsePage(pageParam);
  const session = await verifySession();

  const where: Prisma.OrderWhereInput = {
    companyId: session.companyId,
    ...(q ? { customer: { name: { contains: q } } } : {}),
  };

  const [orders, totalCount] = await Promise.all([
    db.order.findMany({
      where,
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.order.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sales</h1>
          <p className="mt-1 text-sm text-slate-500">
            {totalCount} order{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchForm placeholder="Search by customer..." defaultValue={q} />
          <LinkButton href="/dashboard/sales/new">
            <Plus className="h-4 w-4" />
            New order
          </LinkButton>
        </div>
      </div>

      <Card className="mt-6">
        {orders.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {q ? "No orders match your search." : "No orders yet. Create your first one to get started."}
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
        <Pagination page={page} totalPages={totalPages} basePath="/dashboard/sales" query={{ q }} />
      </Card>
    </div>
  );
}
