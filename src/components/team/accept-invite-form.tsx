"use client";

import { useActionState, useState } from "react";
import { User } from "lucide-react";
import { AuthAlert, AuthField, AuthSubmit, PasswordField } from "@/components/auth/auth-fields";
import type { AcceptInviteFormState } from "@/lib/validation/team";

type Action = (
  state: AcceptInviteFormState,
  formData: FormData
) => Promise<AcceptInviteFormState>;

export function AcceptInviteForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  // Controlled, so a failed attempt keeps the name.
  const [name, setName] = useState("");

  return (
    <form action={formAction} className="space-y-5">
      {state?.message && <AuthAlert tone="error">{state.message}</AuthAlert>}
      <AuthField
        id="name"
        label="Your name"
        icon={User}
        placeholder="Your full name"
        autoComplete="name"
        autoFocus
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        errors={state?.errors?.name}
      />
      <PasswordField autoComplete="new-password" placeholder="Choose a password" errors={state?.errors?.password} showStrength />
      <AuthSubmit pending={pending} pendingText="Joining">
        Join company
      </AuthSubmit>
    </form>
  );
}
