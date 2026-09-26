import { EmployeeForm } from "@/components/hr/employee-form";
import { createEmployee } from "@/lib/actions/hr";
import { dateInputDaysFromNow } from "@/lib/utils";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { branchPicker } from "@/lib/branches";

export default async function NewEmployeePage() {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const branches = await branchPicker();
  const costCenters = await db.costCenter.findMany({
    where: { companyId: session.companyId, active: true },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New employee</h1>
      <div className="mt-6">
        <EmployeeForm branches={branches}
          action={createEmployee}
          defaultValues={{
            name: "",
            email: "",
            position: "",
            department: "",
            salary: 0,
            hireDate: dateInputDaysFromNow(0),
            status: "ACTIVE",
          }}
          costCenters={costCenters.map((c) => ({ id: c.id, label: `${c.code} ${c.name}` }))}
          submitLabel="Create employee"
        />
      </div>
    </div>
  );
}
