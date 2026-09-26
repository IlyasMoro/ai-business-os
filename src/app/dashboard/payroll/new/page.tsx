import { PayrollRunForm } from "@/components/payroll/payroll-run-form";
import { createPayrollRun } from "@/lib/actions/payroll";
import { dateInputDaysFromNow } from "@/lib/utils";
import { requireRole } from "@/lib/dal";
import { BackButton } from "@/components/ui-dark/back-button";

export default async function NewPayrollRunPage() {
  await requireRole(["OWNER", "ADMIN"]);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href="/dashboard/payroll" label="Back to payroll" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New payroll run</h1>
        <div className="mt-6 rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
          <PayrollRunForm
            action={createPayrollRun}
            defaultPeriodStart={dateInputDaysFromNow(-14)}
            defaultPeriodEnd={dateInputDaysFromNow(0)}
            submitLabel="Create payroll run"
          />
        </div>
      </div>
    </div>
  );
}
