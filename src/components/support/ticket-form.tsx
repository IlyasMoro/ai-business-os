"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui-dark/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui-dark/input";
import type { TicketFormState } from "@/lib/validation/support";

type Action = (
  state: TicketFormState,
  formData: FormData
) => Promise<TicketFormState>;

export function TicketForm({
  action,
  customers,
  defaultValues,
  submitLabel = "Create ticket",
}: {
  action: Action;
  customers: { id: string; name: string }[];
  defaultValues?: {
    customerId: string;
    subject: string;
    description: string | null;
    priority: string;
  };
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div>
        <Label htmlFor="customerId">Customer</Label>
        <Select id="customerId" name="customerId" defaultValue={defaultValues?.customerId ?? ""} required>
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
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" name="subject" defaultValue={defaultValues?.subject} required />
        <FieldError messages={state?.errors?.subject} />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaultValues?.description ?? ""}
        />
        <FieldError messages={state?.errors?.description} />
      </div>
      <div>
        <Label htmlFor="priority">Priority</Label>
        <Select id="priority" name="priority" defaultValue={defaultValues?.priority ?? "MEDIUM"}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </Select>
        <FieldError messages={state?.errors?.priority} />
      </div>

      {state?.message && <p className="text-sm text-red-400">{state.message}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
