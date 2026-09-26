import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { branchWhere } from "@/lib/branches";
import type { Prisma } from "@/generated/prisma/client";
import { DonutChart } from "@/components/dash-viz/donut-chart";
import { AllocationBar } from "@/components/dash-viz/allocation-bar";
import { ErrorBanner } from "@/components/ui/error-banner";
import { VIZ } from "@/components/dash-viz/colors";
import { StatusBadge } from "@/components/ui-dark/badge";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { Plus, Search, ChevronLeft, ChevronRight, Download, UserSquare2 } from "lucide-react";
import { EmptyState } from "@/components/ui-dark/empty-state";
import { buttonStyles } from "@/components/ui-dark/button";
import { fieldStyles } from "@/components/ui-dark/input";

const statusColor = {
  ACTIVE: VIZ.emerald,
  TERMINATED: VIZ.muted,
} as const;

function hrHref(page: number, q?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/dashboard/hr?${qs}` : "/dashboard/hr";
}

export default async function HrPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; error?: string }>;
}) {
  const { page: pageParam, q, error } = await searchParams;
  const page = parsePage(pageParam);
  const session = await requireRole(["OWNER", "ADMIN"]);
  const inBranch = await branchWhere();

  const where: Prisma.EmployeeWhereInput = {
    companyId: session.companyId,
    ...inBranch,
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

  const [employees, totalCount, statusGroups, allForDept] = await Promise.all([
    db.employee.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.employee.count({ where }),
    db.employee.groupBy({ by: ["status"], where: { companyId: session.companyId, ...inBranch }, _count: { _all: true } }),
    db.employee.findMany({ where: { companyId: session.companyId, ...inBranch }, select: { department: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const statusMap = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const totalAll = statusGroups.reduce((s, g) => s + g._count._all, 0);

  const deptCounts = new Map<string, number>();
  for (const e of allForDept) {
    const key = e.department?.trim() || "Unassigned";
    deptCounts.set(key, (deptCounts.get(key) ?? 0) + 1);
  }
  const deptRows = Array.from(deptCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const deptColors = [VIZ.blue, VIZ.amber, VIZ.emerald, VIZ.red, VIZ.muted, VIZ.borderLight];

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <ErrorBanner code={error} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Employees</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            {totalCount} employee{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <form method="GET" className="relative w-full min-w-48 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute z-10 left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              name="q"
              placeholder="Search by name, position..."
              defaultValue={q}
              className={fieldStyles("pl-9")}
            />
          </form>
          <a
            href="/api/export/employees"
            className={buttonStyles("secondary")}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
          <Link
            href="/dashboard/hr/new"
            className={buttonStyles("primary")}
          >
            <Plus className="h-4 w-4" />
            New employee
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.09] light:border-white/80 p-6 glass">
          <div className="flex justify-center">
            <DonutChart
              title="Employees by status"
              centerValue={String(totalAll)}
              centerLabel="employees"
              slices={[
                { label: "Active", value: statusMap.get("ACTIVE") ?? 0, color: statusColor.ACTIVE },
                { label: "Terminated", value: statusMap.get("TERMINATED") ?? 0, color: statusColor.TERMINATED },
              ]}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.09] light:border-white/80 p-6 glass">
          <h2 className="text-sm font-semibold text-slate-50 light:text-slate-900">Headcount by department</h2>
          {deptRows.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No employees yet.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {deptRows.map(([dept, count], i) => (
                <AllocationBar
                  key={dept}
                  label={dept}
                  count={count}
                  pct={(count / allForDept.length) * 100}
                  color={deptColors[i % deptColors.length]}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.09] light:border-white/80 glass">
        {employees.length === 0 ? (
          <EmptyState
            icon={UserSquare2}
            title={q ? "No employees match your search" : "No employees yet"}
            description={q ? "Try a different search term, or clear it to see everything." : "Add your team members to manage roles, departments and pay."}
            action={q ? { href: "/dashboard/hr", label: "Clear search", variant: "secondary" } : { href: "/dashboard/hr/new", label: "New employee" }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Position</th>
                <th className="px-5 py-3 font-medium">Department</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/hr/${employee.id}`}
                      className="font-medium text-slate-50 light:text-slate-900 hover:text-blue-400"
                    >
                      {employee.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">{employee.position ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">{employee.department ?? "—"}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={employee.status} color={statusColor[employee.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/[0.06] light:border-slate-200 px-5 py-3">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={hrHref(page - 1, q)}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-300 light:text-slate-600 transition-colors hover:bg-white/5"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Link>
              ) : (
                <span className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-700 light:text-slate-300">
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </span>
              )}
              {page < totalPages ? (
                <Link
                  href={hrHref(page + 1, q)}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-300 light:text-slate-600 transition-colors hover:bg-white/5"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-700 light:text-slate-300">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
