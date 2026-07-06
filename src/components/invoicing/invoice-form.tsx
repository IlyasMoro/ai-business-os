"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import type { InvoiceFormState } from "@/lib/validation/invoicing";

type Action = (
  state: InvoiceFormState,
  formData: FormData
) => Promise<InvoiceFormState>;

export function InvoiceForm({
  action,
  customers,
  defaultDueDate,
  submitLabel = "Create invoice",
}: {
  action: Action;
  customers: { id: string; name: string }[];
  defaultDueDate: string;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div>
        <Label htmlFor="customerId">Customer</Label>
        <Select id="customerId" name="customerId" defaultValue="" required>
          <option value="" disabled>
            Select a customer
          </option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </Select>
        <FieldError messages={state?.errors?.customerId} />
      </div>
      <div>
        <Label htmlFor="dueDate">Due date</Label>
        <Input id="dueDate" name="dueDate" type="date" defaultValue={defaultDueDate} required />
        <FieldError messages={state?.errors?.dueDate} />
      </div>

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : submitLabel}
      </Button>
    </form>
  );
}
