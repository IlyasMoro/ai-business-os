import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Plus } from "lucide-react";

const statusTone = {
  DRAFT: "slate",
  PROCESSED: "blue",
  PAID: "green",
} as const;

export default async function PayrollPage() {
  const session = await verifySession();

  const payrollRuns = await db.payrollRun.findMany({
    where: { companyId: session.companyId },
    orderBy: { periodStart: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Payroll</h1>
          <p className="mt-1 text-sm text-slate-500">
            {payrollRuns.length} payroll run{payrollRuns.length === 1 ? "" : "s"}
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
      </Card>
    </div>
  );
}
