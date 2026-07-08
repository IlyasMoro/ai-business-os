"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/auth";
import { Button } from "@/components/ui-dark/button";
import { Input, Label, FieldError } from "@/components/ui-dark/input";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl"
      />
      <div className="relative w-full max-w-md rounded-xl border border-white/[0.06] bg-[#111111] p-8 shadow-lg">
        <h1 className="text-xl font-semibold text-slate-50">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-400">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>

        {state?.message ? (
          <p className="mt-6 text-sm text-slate-300">{state.message}</p>
        ) : (
          <form action={action} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@company.com" required />
              <FieldError messages={state?.errors?.email} />
            </div>

            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-400">
          <Link href="/login" className="font-medium text-blue-400 hover:text-blue-300">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
