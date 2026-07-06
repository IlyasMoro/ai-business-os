import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ErrorBanner } from "@/components/ui/error-banner";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { Plus } from "lucide-react";

const statusTone = {
  DRAFT: "slate",
  PROCESSED: "blue",
  PAID: "green",
} as const;

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; error?: string }>;
}) {
  const { page: pageParam, error } = await searchParams;
  const page = parsePage(pageParam);
  const session = await requireRole(["OWNER", "ADMIN"]);

  const where = { companyId: session.companyId };

  const [payrollRuns, totalCount] = await Promise.all([
    db.payrollRun.findMany({
      where,
      orderBy: { periodStart: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.payrollRun.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div>
      <ErrorBanner code={error} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Payroll</h1>
          <p className="mt-1 text-sm text-slate-500">
            {totalCount} payroll run{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <LinkButton href="/dashboard/payroll/new">
          <Plus className="h-4 w-4" />
          New payroll run
        </LinkButton>
      </div>

      <Card className="mt-6">
        {payrollRuns.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No payroll runs yet. Create your first one to get started.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Period</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {payrollRuns.map((run) => (
                <tr key={run.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/payroll/${run.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {run.periodStart.toLocaleDateString()} – {run.periodEnd.toLocaleDateString()}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone[run.status]}>{run.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-600">${run.totalAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} basePath="/dashboard/payroll" query={{}} />
      </Card>
    </div>
  );
}
