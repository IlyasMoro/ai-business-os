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
  LEAD: "yellow",
  ACTIVE: "green",
  INACTIVE: "slate",
} as const;

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageParam, q } = await searchParams;
  const page = parsePage(pageParam);
  const session = await verifySession();

  const where: Prisma.CustomerWhereInput = {
    companyId: session.companyId,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { company: { contains: q } },
          ],
        }
      : {}),
  };

  const [customers, totalCount] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.customer.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">
            {totalCount} customer{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchForm placeholder="Search customers..." defaultValue={q} />
          <LinkButton href="/dashboard/crm/new">
            <Plus className="h-4 w-4" />
            New customer
          </LinkButton>
        </div>
      </div>

      <Card className="mt-6">
        {customers.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {q
              ? "No customers match your search."
              : "No customers yet. Add your first one to get started."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Company</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/crm/${customer.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {customer.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{customer.company ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{customer.email ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone[customer.status]}>{customer.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} basePath="/dashboard/crm" query={{ q }} />
      </Card>
    </div>
  );
}
