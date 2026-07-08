"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui-dark/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui-dark/input";
import type { ProjectFormState } from "@/lib/validation/projects";

type Action = (
  state: ProjectFormState,
  formData: FormData
) => Promise<ProjectFormState>;

export function ProjectForm({
  action,
  customers,
  defaultValues,
  submitLabel = "Create project",
}: {
  action: Action;
  customers: { id: string; name: string }[];
  defaultValues?: {
    name: string;
    description: string | null;
    customerId: string | null;
    dueDate: string;
  };
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={defaultValues?.name} required />
        <FieldError messages={state?.errors?.name} />
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="customerId">Customer</Label>
          <Select id="customerId" name="customerId" defaultValue={defaultValues?.customerId ?? ""}>
            <option value="">No customer</option>
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
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={defaultValues?.dueDate ?? ""}
          />
          <FieldError messages={state?.errors?.dueDate} />
        </div>
      </div>

      {state?.message && <p className="text-sm text-red-400">{state.message}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
