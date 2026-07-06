import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Plus } from "lucide-react";

const statusTone = {
  ACTIVE: "green",
  TERMINATED: "slate",
} as const;

export default async function HrPage() {
  const session = await verifySession();

  const employees = await db.employee.findMany({
    where: { companyId: session.companyId },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">HR</h1>
          <p className="mt-1 text-sm text-slate-500">
            {employees.length} employee{employees.length === 1 ? "" : "s"}
          </p>
        </div>
        <LinkButton href="/dashboard/hr/new">
          <Plus className="h-4 w-4" />
          New employee
        </LinkButton>
      </div>

      <Card className="mt-6">
        {employees.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No employees yet. Add your first one to get started.
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
      </Card>
    </div>
  );
}
