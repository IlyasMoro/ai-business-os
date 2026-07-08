"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui-dark/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui-dark/input";
import type { TransactionFormState } from "@/lib/validation/accounting";

type Action = (
  state: TransactionFormState,
  formData: FormData
) => Promise<TransactionFormState>;

export function TransactionForm({
  action,
  defaultValues,
  submitLabel = "Save transaction",
}: {
  action: Action;
  defaultValues?: {
    type: string;
    category: string;
    amount: number;
    date: string;
    description: string | null;
  };
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type</Label>
          <Select id="type" name="type" defaultValue={defaultValues?.type ?? "INCOME"}>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
          </Select>
          <FieldError messages={state?.errors?.type} />
        </div>
        <div>
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.amount}
            required
          />
          <FieldError messages={state?.errors?.amount} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category">Category</Label>
          <Input id="category" name="category" defaultValue={defaultValues?.category} required />
          <FieldError messages={state?.errors?.category} />
        </div>
        <div>
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" defaultValue={defaultValues?.date} required />
          <FieldError messages={state?.errors?.date} />
        </div>
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

      {state?.message && <p className="text-sm text-red-400">{state.message}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
