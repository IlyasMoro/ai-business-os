"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login } from "@/lib/actions/auth";
import { Button } from "@/components/ui-dark/button";
import { Input, Label, FieldError } from "@/components/ui-dark/input";

function ResetSuccessBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("reset") !== "success") return null;
  return (
    <p className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
      Your password has been reset. Sign in with your new password.
    </p>
  );
}

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#0B1120] px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl"
      />
      <div className="relative w-full max-w-md rounded-xl border border-white/[0.06] bg-[#1A2238] p-8 shadow-lg">
        <h1 className="text-xl font-semibold text-slate-50">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-400">Sign in to your business dashboard.</p>

        <Suspense fallback={null}>
          <ResetSuccessBanner />
        </Suspense>

        <form action={action} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@company.com" required />
            <FieldError messages={state?.errors?.email} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="mb-1 text-sm font-medium text-blue-400 hover:text-blue-300">
                Forgot password?
              </Link>
            </div>
            <Input id="password" name="password" type="password" required />
            <FieldError messages={state?.errors?.password} />
          </div>

          {state?.message && (
            <p className="text-sm text-red-400">{state.message}</p>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-blue-400 hover:text-blue-300">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
