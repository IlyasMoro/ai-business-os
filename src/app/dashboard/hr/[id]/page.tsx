import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { Badge } from "@/components/ui-dark/badge";
import { LinkButton } from "@/components/ui-dark/button";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { deleteEmployee } from "@/lib/actions/hr";
import { Pencil } from "lucide-react";

const statusTone = {
  ACTIVE: "green",
  TERMINATED: "slate",
} as const;

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await requireRole(["OWNER", "ADMIN"]);

  const employee = await db.employee.findUnique({
    where: { id, companyId: session.companyId },
  });

  if (!employee) notFound();

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6">
      <div className="max-w-3xl">
        {error === "in-use" && (
          <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            This employee can&apos;t be deleted because they&apos;re referenced in a payroll run.
          </p>
        )}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-50">{employee.name}</h1>
              <Badge tone={statusTone[employee.status]}>{employee.status}</Badge>
            </div>
            {employee.position && <p className="mt-1 text-slate-400">{employee.position}</p>}
          </div>
          <div className="flex items-center gap-2">
            <LinkButton href={`/dashboard/hr/${employee.id}/edit`} variant="secondary" size="sm">
              <Pencil className="h-4 w-4" />
              Edit
            </LinkButton>
            <DeleteButton action={deleteEmployee.bind(null, employee.id)} />
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Email</p>
              <p className="text-slate-50">{employee.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-slate-500">Department</p>
              <p className="text-slate-50">{employee.department ?? "—"}</p>
            </div>
            <div>
              <p className="text-slate-500">Salary</p>
              <p className="font-mono tabular-nums text-slate-50">${employee.salary.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500">Hire date</p>
              <p className="text-slate-50">{employee.hireDate.toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6">
          <Link href="/dashboard/hr" className="text-sm text-slate-500 hover:text-slate-300">
            ← Back to HR
          </Link>
        </p>
      </div>
    </div>
  );
}
