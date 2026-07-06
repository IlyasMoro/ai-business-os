import { PayrollRunForm } from "@/components/payroll/payroll-run-form";
import { createPayrollRun } from "@/lib/actions/payroll";
import { dateInputDaysFromNow } from "@/lib/utils";

export default function NewPayrollRunPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">New payroll run</h1>
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
