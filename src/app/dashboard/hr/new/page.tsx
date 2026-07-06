import { EmployeeForm } from "@/components/hr/employee-form";
import { createEmployee } from "@/lib/actions/hr";
import { dateInputDaysFromNow } from "@/lib/utils";

export default function NewEmployeePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">New employee</h1>
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
