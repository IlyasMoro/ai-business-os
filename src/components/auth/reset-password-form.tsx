"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui-dark/button";
import { Input, Label, FieldError } from "@/components/ui-dark/input";
import type { ResetPasswordFormState } from "@/lib/validation/auth";

type Action = (
  state: ResetPasswordFormState,
  formData: FormData
) => Promise<ResetPasswordFormState>;

export function ResetPasswordForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" required />
        <FieldError messages={state?.errors?.password} />
      </div>

      {state?.message && <p className="text-sm text-red-400 light:text-red-600">{state.message}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Resetting..." : "Reset password"}
      </Button>
    </form>
  );
}
