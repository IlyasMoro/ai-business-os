"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui-dark/button";
import { Textarea, FieldError } from "@/components/ui-dark/input";
import { addTaskComment } from "@/lib/actions/projects";
import type { TaskCommentFormState } from "@/lib/validation/projects";

export function TaskCommentForm({ projectId, taskId }: { projectId: string; taskId: string }) {
  const action = addTaskComment.bind(null, projectId, taskId) as (
    state: TaskCommentFormState,
    formData: FormData
  ) => Promise<TaskCommentFormState>;
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.errors && !state?.message && !pending) {
      formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex items-start gap-2">
      <div className="flex-1">
        <Textarea name="content" placeholder="Add a comment..." rows={2} required />
        <FieldError messages={state?.errors?.content} />
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Posting..." : "Post"}
      </Button>
      {state?.message && <p className="text-sm text-red-400">{state.message}</p>}
    </form>
  );
}
