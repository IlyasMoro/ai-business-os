"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, FieldError } from "@/components/ui/input";
import { addPayrollItem } from "@/lib/actions/payroll";
import type { PayrollItemFormState } from "@/lib/validation/payroll";

export function PayrollItemForm({
  payrollRunId,
  employees,
}: {
  payrollRunId: string;
  employees: { id: string; name: string; salary: number }[];
}) {
  const action = addPayrollItem.bind(null, payrollRunId) as (
    state: PayrollItemFormState,
    formData: FormData
  ) => Promise<PayrollItemFormState>;
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.errors && !state?.message && !pending) {
      formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div className="col-span-2">
        <Select name="employeeId" defaultValue="" required>
          <option value="" disabled>
            Select an employee
          </option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </Select>
        <FieldError messages={state?.errors?.employeeId} />
      </div>
      <div>
        <Input name="grossPay" type="number" min="0" step="0.01" placeholder="Gross pay" required />
        <FieldError messages={state?.errors?.grossPay} />
      </div>
      <div>
        <Input
          name="deductions"
          type="number"
          min="0"
          step="0.01"
          placeholder="Deductions"
          defaultValue={0}
          required
        />
        <FieldError messages={state?.errors?.deductions} />
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Adding..." : "Add item"}
      </Button>
      {state?.message && <p className="col-span-full text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
