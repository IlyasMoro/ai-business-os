"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { verifySecondStep } from "@/lib/actions/auth";
import { AuthAlert, AuthField, AuthSubmit, authLink } from "@/components/auth/auth-fields";

/** The code from the authenticator app, or one of the recovery codes. */
export function SecondStepForm() {
  const [state, action, pending] = useActionState(verifySecondStep, undefined);
  const [recovery, setRecovery] = useState(false);

  return (
    <div className="space-y-6">
      {state?.message && <AuthAlert tone="error">{state.message}</AuthAlert>}

      <form action={action} className="space-y-5">
        {recovery ? (
          <AuthField
            key="recovery"
            id="code"
            label="Recovery code"
            icon={KeyRound}
            placeholder="k7mq9 x2pfr"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            required
            hint="Each recovery code works once."
          />
        ) : (
          <AuthField
            key="app"
            id="code"
            label="6 digit code"
            icon={ShieldCheck}
            placeholder="123 456"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            autoFocus
            required
            className="tracking-[0.3em]"
            hint="Open your authenticator app and type the code shown for AIBOS."
          />
        )}

        <AuthSubmit pending={pending} pendingText="Checking">
          Verify and sign in
        </AuthSubmit>
      </form>

      <div className="flex items-center justify-between text-sm">
        <Link href="/login" className={`inline-flex items-center gap-1.5 ${authLink}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Start over
        </Link>
        <button type="button" onClick={() => setRecovery((v) => !v)} className={authLink}>
          {recovery ? "Use the app code" : "Lost your phone?"}
        </button>
      </div>
    </div>
  );
}
