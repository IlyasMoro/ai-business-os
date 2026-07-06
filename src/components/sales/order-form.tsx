"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select, FieldError } from "@/components/ui/input";
import type { OrderFormState } from "@/lib/validation/sales";

type Action = (
  state: OrderFormState,
  formData: FormData
) => Promise<OrderFormState>;

export function OrderForm({
  action,
  customers,
  submitLabel = "Create order",
}: {
  action: Action;
  customers: { id: string; name: string }[];
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

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : submitLabel}
      </Button>
    </form>
  );
}
