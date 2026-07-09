import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { EmployeeForm } from "@/components/hr/employee-form";
import { updateEmployee } from "@/lib/actions/hr";
import type { EmployeeFormState } from "@/lib/validation/hr";
import { toDateInputValue } from "@/lib/utils";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole(["OWNER", "ADMIN"]);

  const employee = await db.employee.findUnique({
    where: { id, companyId: session.companyId },
  });

  if (!employee) notFound();

  const action = updateEmployee.bind(null, employee.id) as (
    state: EmployeeFormState,
    formData: FormData
  ) => Promise<EmployeeFormState>;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Edit employee</h1>
      <div className="mt-6">
        <EmployeeForm
          action={action}
          defaultValues={{
            name: employee.name,
            email: employee.email,
            position: employee.position,
            department: employee.department,
            salary: employee.salary,
            hireDate: toDateInputValue(employee.hireDate),
            status: employee.status,
          }}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
