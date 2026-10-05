"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register } from "@/lib/actions/auth";
import { publicField, publicLabel } from "@/components/public/customer-shell";
import { cn } from "@/lib/utils";
import styles from "@/components/landing/landing.module.css";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-sm text-red-600">{messages[0]}</p>;
}

/** The sign up form on the light public page: names side by side. */
export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="companyName" className={publicLabel}>
            Company name
          </label>
          <input id="companyName" name="companyName" placeholder="Acme Retail Co." autoComplete="organization" required className={publicField} />
          <FieldError messages={state?.errors?.companyName} />
        </div>
        <div>
          <label htmlFor="name" className={publicLabel}>
            Your name
          </label>
          <input id="name" name="name" placeholder="Jane Doe" autoComplete="name" required className={publicField} />
          <FieldError messages={state?.errors?.name} />
        </div>
      </div>
      <div>
        <label htmlFor="email" className={publicLabel}>
          Email
        </label>
        <input id="email" name="email" type="email" placeholder="you@company.com" autoComplete="email" required className={publicField} />
        <FieldError messages={state?.errors?.email} />
      </div>
      <div>
        <label htmlFor="password" className={publicLabel}>
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={publicField} />
        {state?.errors?.password ? (
          <FieldError messages={state.errors.password} />
        ) : (
          <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
        )}
      </div>

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

      <div>
        <button type="submit" disabled={pending} className={cn(styles.btn, styles.sendBtn)}>
          {pending ? "Creating account..." : "Create account"}
        </button>
        <p className="mt-3 text-center text-xs text-slate-500">
          By creating an account, you agree to our{" "}
          <Link href="/terms" className="font-semibold text-[#0b1f5e] underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold text-[#0b1f5e] underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
