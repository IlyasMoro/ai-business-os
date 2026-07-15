"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui-dark/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui-dark/input";
import { suggestCategory } from "@/lib/actions/accounting";
import type { TransactionFormState } from "@/lib/validation/accounting";
import { Sparkles } from "lucide-react";

type Action = (
  state: TransactionFormState,
  formData: FormData
) => Promise<TransactionFormState>;

export function TransactionForm({
  action,
  defaultValues,
  existingCategories = [],
  projects = [],
  submitLabel = "Save transaction",
}: {
  action: Action;
  defaultValues?: {
    type: string;
    category: string;
    amount: number;
    date: string;
    description: string | null;
    projectId?: string | null;
  };
  existingCategories?: string[];
  projects?: { id: string; name: string }[];
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [category, setCategory] = useState(defaultValues?.category ?? "");
  const [suggesting, startSuggesting] = useTransition();
  const typeRef = useRef<HTMLSelectElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  function handleSuggest() {
    const description = descriptionRef.current?.value ?? "";
    const type = (typeRef.current?.value as "INCOME" | "EXPENSE") ?? "INCOME";
    startSuggesting(async () => {
      const suggestion = await suggestCategory(description, type);
      if (suggestion) setCategory(suggestion);
    });
  }

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type</Label>
          <Select ref={typeRef} id="type" name="type" defaultValue={defaultValues?.type ?? "INCOME"}>
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
          <div className="flex gap-2">
            <Input
              id="category"
              name="category"
              list="category-options"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={handleSuggest}
              disabled={suggesting}
              title="Suggest a category with AI based on the description"
              className="flex shrink-0 items-center gap-1 rounded-md border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white px-2.5 text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </div>
          <datalist id="category-options">
            {existingCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
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
          ref={descriptionRef}
          id="description"
          name="description"
          rows={3}
          defaultValue={defaultValues?.description ?? ""}
        />
        <FieldError messages={state?.errors?.description} />
      </div>

      {projects.length > 0 && (
        <div>
          <Label htmlFor="projectId">Project (optional)</Label>
          <Select id="projectId" name="projectId" defaultValue={defaultValues?.projectId ?? ""}>
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
          <FieldError messages={state?.errors?.projectId} />
        </div>
      )}

      {state?.message && <p className="text-sm text-red-400">{state.message}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
