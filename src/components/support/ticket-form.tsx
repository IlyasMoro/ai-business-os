"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui-dark/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui-dark/input";
import { suggestPriority } from "@/lib/actions/support";
import type { TicketFormState } from "@/lib/validation/support";
import { Sparkles } from "lucide-react";

type Action = (
  state: TicketFormState,
  formData: FormData
) => Promise<TicketFormState>;

export function TicketForm({
  action,
  customers,
  employees = [],
  defaultValues,
  submitLabel = "Create ticket",
}: {
  action: Action;
  customers: { id: string; name: string }[];
  employees?: { id: string; name: string }[];
  defaultValues?: {
    customerId: string;
    subject: string;
    description: string | null;
    priority: string;
    assigneeId?: string | null;
  };
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [priority, setPriority] = useState(defaultValues?.priority ?? "MEDIUM");
  const [suggesting, startSuggesting] = useTransition();
  const subjectRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  function handleSuggest() {
    const subject = subjectRef.current?.value ?? "";
    const description = descriptionRef.current?.value ?? "";
    startSuggesting(async () => {
      const suggestion = await suggestPriority(subject, description);
      if (suggestion) setPriority(suggestion);
    });
  }

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
        <Input ref={subjectRef} id="subject" name="subject" defaultValue={defaultValues?.subject} required />
        <FieldError messages={state?.errors?.subject} />
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="priority">Priority</Label>
          <div className="flex gap-2">
            <Select
              id="priority"
              name="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </Select>
            <button
              type="button"
              onClick={handleSuggest}
              disabled={suggesting}
              title="Suggest priority with AI based on subject and description"
              className="flex shrink-0 items-center gap-1 rounded-md border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white px-2.5 text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </div>
          <FieldError messages={state?.errors?.priority} />
        </div>
        <div>
          <Label htmlFor="assigneeId">Assignee</Label>
          <Select id="assigneeId" name="assigneeId" defaultValue={defaultValues?.assigneeId ?? ""}>
            <option value="">Unassigned</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </Select>
          <FieldError messages={state?.errors?.assigneeId} />
        </div>
      </div>

      {state?.message && <p className="text-sm text-red-400">{state.message}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
