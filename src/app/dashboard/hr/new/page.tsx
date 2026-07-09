import { EmployeeForm } from "@/components/hr/employee-form";
import { createEmployee } from "@/lib/actions/hr";
import { dateInputDaysFromNow } from "@/lib/utils";
import { requireRole } from "@/lib/dal";

export default async function NewEmployeePage() {
  await requireRole(["OWNER", "ADMIN"]);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New employee</h1>
      <div className="mt-6">
        <EmployeeForm
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
          submitLabel="Create employee"
        />
      </div>
    </div>
  );
}
