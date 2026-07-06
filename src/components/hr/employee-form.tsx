"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import type { EmployeeFormState } from "@/lib/validation/hr";

type Action = (
  state: EmployeeFormState,
  formData: FormData
) => Promise<EmployeeFormState>;

export function EmployeeForm({
  action,
  defaultValues,
  submitLabel = "Save employee",
}: {
  action: Action;
  defaultValues?: {
    name: string;
    email: string | null;
    position: string | null;
    department: string | null;
    salary: number;
    hireDate: string;
    status: string;
  };
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={defaultValues?.name} required />
          <FieldError messages={state?.errors?.name} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={defaultValues?.email ?? ""} />
          <FieldError messages={state?.errors?.email} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="position">Position</Label>
          <Input id="position" name="position" defaultValue={defaultValues?.position ?? ""} />
          <FieldError messages={state?.errors?.position} />
        </div>
        <div>
          <Label htmlFor="department">Department</Label>
          <Input id="department" name="department" defaultValue={defaultValues?.department ?? ""} />
          <FieldError messages={state?.errors?.department} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="salary">Salary</Label>
          <Input
            id="salary"
            name="salary"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.salary ?? 0}
            required
          />
          <FieldError messages={state?.errors?.salary} />
        </div>
        <div>
          <Label htmlFor="hireDate">Hire date</Label>
          <Input
            id="hireDate"
            name="hireDate"
            type="date"
            defaultValue={defaultValues?.hireDate}
            required
          />
          <FieldError messages={state?.errors?.hireDate} />
        </div>
      </div>
      <div>
        <Label htmlFor="status">Status</Label>
        <Select id="status" name="status" defaultValue={defaultValues?.status ?? "ACTIVE"}>
          <option value="ACTIVE">Active</option>
          <option value="TERMINATED">Terminated</option>
        </Select>
        <FieldError messages={state?.errors?.status} />
      </div>

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
