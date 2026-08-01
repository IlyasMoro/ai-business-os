"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui-dark/button";
import { Input, Label, FieldError } from "@/components/ui-dark/input";
import type { AcceptInviteFormState } from "@/lib/validation/team";

type Action = (
  state: AcceptInviteFormState,
  formData: FormData
) => Promise<AcceptInviteFormState>;

export function AcceptInviteForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" placeholder="Jane Doe" required />
        <FieldError messages={state?.errors?.name} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required />
        <FieldError messages={state?.errors?.password} />
      </div>

      {state?.message && <p className="text-sm text-red-400 light:text-red-600">{state.message}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Joining..." : "Join company"}
      </Button>
    </form>
  );
}
