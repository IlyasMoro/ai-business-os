"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui-dark/button";
import { Input, Label, FieldError } from "@/components/ui-dark/input";
import type { PayrollRunFormState } from "@/lib/validation/payroll";

type Action = (
  state: PayrollRunFormState,
  formData: FormData
) => Promise<PayrollRunFormState>;

export function PayrollRunForm({
  action,
  defaultPeriodStart,
  defaultPeriodEnd,
  submitLabel = "Create payroll run",
}: {
  action: Action;
  defaultPeriodStart: string;
  defaultPeriodEnd: string;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="periodStart">Period start</Label>
          <Input
            id="periodStart"
            name="periodStart"
            type="date"
            defaultValue={defaultPeriodStart}
            required
          />
          <FieldError messages={state?.errors?.periodStart} />
        </div>
        <div>
          <Label htmlFor="periodEnd">Period end</Label>
          <Input
            id="periodEnd"
            name="periodEnd"
            type="date"
            defaultValue={defaultPeriodEnd}
            required
          />
          <FieldError messages={state?.errors?.periodEnd} />
        </div>
      </div>

      {state?.message && <p className="text-sm text-red-400">{state.message}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : submitLabel}
      </Button>
    </form>
  );
}
