import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/ui/delete-button";
import { PayrollItemForm } from "@/components/payroll/payroll-item-form";
import { PayrollRunStatusForm } from "@/components/payroll/payroll-run-status-form";
import { deletePayrollRun, removePayrollItem } from "@/lib/actions/payroll";

const statusTone = {
  DRAFT: "slate",
  PROCESSED: "blue",
  PAID: "green",
} as const;

export default async function PayrollRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole(["OWNER", "ADMIN"]);

  const payrollRun = await db.payrollRun.findUnique({
    where: { id, companyId: session.companyId },
    include: {
      items: { include: { employee: true } },
    },
  });

  if (!payrollRun) notFound();

  const employees = await db.employee.findMany({
    where: { companyId: session.companyId, status: "ACTIVE" },
    select: { id: true, name: true, salary: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
              {payrollRun.periodStart.toLocaleDateString()} –{" "}
              {payrollRun.periodEnd.toLocaleDateString()}
            </h1>
            <Badge tone={statusTone[payrollRun.status]}>{payrollRun.status}</Badge>
          </div>
          {payrollRun.processedAt && (
            <p className="mt-1 text-sm text-slate-500">
              Processed {payrollRun.processedAt.toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PayrollRunStatusForm payrollRunId={payrollRun.id} status={payrollRun.status} />
          <DeleteButton action={deletePayrollRun.bind(null, payrollRun.id)} />
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          {payrollRun.items.length > 0 && (
            <ul className="mb-4 divide-y divide-slate-100">
              {payrollRun.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{item.employee.name}</p>
                    <p className="text-slate-500">
                      Gross ${item.grossPay.toFixed(2)} − Deductions ${item.deductions.toFixed(2)} =
                      Net ${item.netPay.toFixed(2)}
                    </p>
                  </div>
                  <DeleteButton
                    action={removePayrollItem.bind(null, payrollRun.id, item.id)}
                    confirmMessage="Remove this payroll item?"
                    label=""
                  />
                </li>
              ))}
            </ul>
          )}
          <PayrollItemForm payrollRunId={payrollRun.id} employees={employees} />
          <p className="mt-4 text-right text-sm font-semibold text-slate-900">
            Total: ${payrollRun.totalAmount.toFixed(2)}
          </p>
        </CardContent>
      </Card>

      <p className="mt-6">
        <Link href="/dashboard/payroll" className="text-sm text-slate-500 hover:text-slate-700">
          ← Back to payroll
        </Link>
      </p>
    </div>
  );
}
