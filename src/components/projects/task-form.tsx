"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui-dark/button";
import { Input, Select, FieldError } from "@/components/ui-dark/input";
import { addTask } from "@/lib/actions/projects";
import type { TaskFormState } from "@/lib/validation/projects";

export function TaskForm({
  projectId,
  employees,
}: {
  projectId: string;
  employees: { id: string; name: string }[];
}) {
  const action = addTask.bind(null, projectId) as (
    state: TaskFormState,
    formData: FormData
  ) => Promise<TaskFormState>;
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.errors && !state?.message && !pending) {
      formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div className="col-span-2">
        <Input name="title" placeholder="Task title" required />
        <FieldError messages={state?.errors?.title} />
      </div>
      <div>
        <Select name="assigneeId" defaultValue="">
          <option value="">Unassigned</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </Select>
        <FieldError messages={state?.errors?.assigneeId} />
      </div>
      <div>
        <Select name="priority" defaultValue="MEDIUM">
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </Select>
        <FieldError messages={state?.errors?.priority} />
      </div>
      <div>
        <Input name="dueDate" type="date" />
        <FieldError messages={state?.errors?.dueDate} />
      </div>
      <Button
        type="submit"
        variant="secondary"
        disabled={pending}
        className="col-span-full sm:col-span-1"
      >
        {pending ? "Adding..." : "Add task"}
      </Button>
      {state?.message && <p className="col-span-full text-sm text-red-400">{state.message}</p>}
    </form>
  );
}
