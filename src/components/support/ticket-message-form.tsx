"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui-dark/button";
import { Textarea, FieldError } from "@/components/ui-dark/input";
import { addTicketMessage } from "@/lib/actions/support";
import type { TicketMessageFormState } from "@/lib/validation/support";

export function TicketMessageForm({ ticketId }: { ticketId: string }) {
  const action = addTicketMessage.bind(null, ticketId) as (
    state: TicketMessageFormState,
    formData: FormData
  ) => Promise<TicketMessageFormState>;
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
        <Textarea name="content" placeholder="Reply to this ticket..." rows={2} required />
        <FieldError messages={state?.errors?.content} />
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Sending..." : "Reply"}
      </Button>
      {state?.message && <p className="text-sm text-red-400">{state.message}</p>}
    </form>
  );
}
