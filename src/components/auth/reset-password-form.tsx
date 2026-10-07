"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthAlert, AuthSubmit, PasswordField, authLink } from "@/components/auth/auth-fields";
import type { ResetPasswordFormState } from "@/lib/validation/auth";

type Action = (
  state: ResetPasswordFormState,
  formData: FormData
) => Promise<ResetPasswordFormState>;

export function ResetPasswordForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-5">
        {state?.message && <AuthAlert tone="error">{state.message}</AuthAlert>}
        <PasswordField
          label="New password"
          autoComplete="new-password"
          placeholder="Choose a new password"
          errors={state?.errors?.password}
          showStrength
        />
        <AuthSubmit pending={pending} pendingText="Saving">
          Save new password
        </AuthSubmit>
      </form>

      <p className="text-center text-sm">
        <Link href="/login" className={`inline-flex items-center gap-1.5 ${authLink}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
