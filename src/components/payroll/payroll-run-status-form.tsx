"use client";

import { useRef } from "react";
import { Select } from "@/components/ui-dark/input";
import { updatePayrollRunStatus } from "@/lib/actions/payroll";

export function PayrollRunStatusForm({
  payrollRunId,
  status,
}: {
  payrollRunId: string;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = updatePayrollRunStatus.bind(null, payrollRunId);

  return (
    <form ref={formRef} action={action}>
      <Select
        name="status"
        defaultValue={status}
        className="w-auto"
        onChange={() => formRef.current?.requestSubmit()}
      >
        <option value="DRAFT">Draft</option>
        <option value="PROCESSED">Processed</option>
        <option value="PAID">Paid</option>
      </Select>
    </form>
  );
}
