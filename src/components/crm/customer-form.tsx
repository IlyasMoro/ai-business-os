"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import type { CustomerFormState } from "@/lib/validation/crm";

type Action = (
  state: CustomerFormState,
  formData: FormData
) => Promise<CustomerFormState>;

export function CustomerForm({
  action,
  defaultValues,
  submitLabel = "Save customer",
}: {
  action: Action;
  defaultValues?: {
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    status: string;
    notes: string | null;
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={defaultValues?.email ?? ""} />
          <FieldError messages={state?.errors?.email} />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={defaultValues?.phone ?? ""} />
          <FieldError messages={state?.errors?.phone} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="company">Company</Label>
          <Input id="company" name="company" defaultValue={defaultValues?.company ?? ""} />
          <FieldError messages={state?.errors?.company} />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={defaultValues?.status ?? "LEAD"}>
            <option value="LEAD">Lead</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
          <FieldError messages={state?.errors?.status} />
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={4} defaultValue={defaultValues?.notes ?? ""} />
        <FieldError messages={state?.errors?.notes} />
      </div>

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
