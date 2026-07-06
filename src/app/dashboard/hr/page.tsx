import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { SearchForm } from "@/components/ui/search-form";
import { Pagination } from "@/components/ui/pagination";
import { ErrorBanner } from "@/components/ui/error-banner";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { Plus } from "lucide-react";

const statusTone = {
  ACTIVE: "green",
  TERMINATED: "slate",
} as const;

export default async function HrPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; error?: string }>;
}) {
  const { page: pageParam, q, error } = await searchParams;
  const page = parsePage(pageParam);
  const session = await requireRole(["OWNER", "ADMIN"]);

  const where: Prisma.EmployeeWhereInput = {
    companyId: session.companyId,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { position: { contains: q } },
            { department: { contains: q } },
          ],
        }
      : {}),
  };

  const [employees, totalCount] = await Promise.all([
    db.employee.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.employee.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div>
      <ErrorBanner code={error} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">HR</h1>
          <p className="mt-1 text-sm text-slate-500">
            {totalCount} employee{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchForm placeholder="Search by name, position..." defaultValue={q} />
          <LinkButton href="/dashboard/hr/new">
            <Plus className="h-4 w-4" />
            New employee
          </LinkButton>
        </div>
      </div>

      <Card className="mt-6">
        {employees.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {q
              ? "No employees match your search."
              : "No employees yet. Add your first one to get started."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Position</th>
                <th className="px-5 py-3 font-medium">Department</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/hr/${employee.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {employee.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{employee.position ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{employee.department ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone[employee.status]}>{employee.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} basePath="/dashboard/hr" query={{ q }} />
      </Card>
    </div>
  );
}
