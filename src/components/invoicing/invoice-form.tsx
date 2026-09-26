"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui-dark/button";
import { BranchSelect, type BranchPicker } from "@/components/layout/branch-select";
import { Input, Label, Select, FieldError } from "@/components/ui-dark/input";
import type { InvoiceFormState } from "@/lib/validation/invoicing";

type Action = (
  state: InvoiceFormState,
  formData: FormData
) => Promise<InvoiceFormState>;

export function InvoiceForm({
  action,
  customers,
  branches,
  defaultDueDate,
  defaultTaxRate = 0,
  submitLabel = "Create invoice",
}: {
  action: Action;
  customers: { id: string; name: string }[];
  branches?: BranchPicker | null;
  defaultDueDate: string;
  defaultTaxRate?: number;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
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
      <div>
        <Label htmlFor="taxRate">Tax rate (%)</Label>
        <Input
          id="taxRate"
          name="taxRate"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaultTaxRate}
          required
        />
        <FieldError messages={state?.errors?.taxRate} />
      </div>

      {state?.message && <p className="text-sm text-red-400">{state.message}</p>}

      {branches && <BranchSelect {...branches} />}


      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : submitLabel}
      </Button>
    </form>
  );
}
