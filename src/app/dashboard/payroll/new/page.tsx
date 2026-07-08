import { PayrollRunForm } from "@/components/payroll/payroll-run-form";
import { createPayrollRun } from "@/lib/actions/payroll";
import { dateInputDaysFromNow } from "@/lib/utils";
import { requireRole } from "@/lib/dal";

export default async function NewPayrollRunPage() {
  await requireRole(["OWNER", "ADMIN"]);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-[#0B1120] p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50">New payroll run</h1>
      <div className="mt-6">
        <PayrollRunForm
          action={createPayrollRun}
          defaultPeriodStart={dateInputDaysFromNow(-14)}
          defaultPeriodEnd={dateInputDaysFromNow(0)}
          submitLabel="Create payroll run"
        />
      </div>
    </div>
  );
}
