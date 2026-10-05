"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login } from "@/lib/actions/auth";
import { publicField, publicLabel } from "@/components/public/customer-shell";
import { cn } from "@/lib/utils";
import styles from "@/components/landing/landing.module.css";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-sm text-red-600">{messages[0]}</p>;
}

function ResetSuccessBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("reset") !== "success") return null;
  return (
    <p className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      Your password has been reset. Sign in with your new password.
    </p>
  );
}

/** The sign in form on the light public page. */
export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div>
      <Suspense fallback={null}>
        <ResetSuccessBanner />
      </Suspense>
      <form action={action} className="space-y-4">
        <div>
          <label htmlFor="email" className={publicLabel}>
            Email
          </label>
          <input id="email" name="email" type="email" placeholder="you@company.com" autoComplete="email" required className={publicField} />
          <FieldError messages={state?.errors?.email} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className={publicLabel}>
              Password
            </label>
            <Link href="/forgot-password" className="mb-1.5 text-sm font-semibold text-[#0b1f5e] hover:underline">
              Forgot password?
            </Link>
          </div>
          <input id="password" name="password" type="password" autoComplete="current-password" required className={publicField} />
          <FieldError messages={state?.errors?.password} />
        </div>

        {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

        <button type="submit" disabled={pending} className={cn(styles.btn, styles.sendBtn)}>
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
