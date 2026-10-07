"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { requestPasswordReset } from "@/lib/actions/auth";
import { AuthAlert, AuthField, AuthSubmit, authLink } from "@/components/auth/auth-fields";

/** Asks for a reset link. The reply is the same whether or not the email
    has an account, so nobody can use this to find out who signed up. */
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <div className="space-y-6">
      {state?.message ? (
        <AuthAlert tone="success">
          <p className="font-semibold text-emerald-900">Check your inbox</p>
          <p className="mt-0.5">{state.message}</p>
        </AuthAlert>
      ) : (
        <form action={action} className="space-y-5">
          <AuthField
            id="email"
            type="email"
            label="Work email"
            icon={Mail}
            placeholder="you@company.com"
            autoComplete="email"
            autoFocus
            required
            errors={state?.errors?.email}
          />
          <AuthSubmit pending={pending} pendingText="Sending link">
            Send reset link
          </AuthSubmit>
        </form>
      )}

      <p className="text-center text-sm">
        <Link href="/login" className={`inline-flex items-center gap-1.5 ${authLink}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
