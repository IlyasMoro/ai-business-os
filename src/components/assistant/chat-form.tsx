"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui-dark/button";
import { Input, FieldError } from "@/components/ui-dark/input";
import { sendChatMessage } from "@/lib/actions/assistant";

export function ChatForm() {
  const [state, formAction, pending] = useActionState(sendChatMessage, undefined);
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
        <Input name="content" placeholder="Ask a question..." autoComplete="off" required />
        <FieldError messages={state?.errors?.content} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending..." : "Send"}
      </Button>
    </form>
  );
}
