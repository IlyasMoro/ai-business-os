"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(register, undefined);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-500/15"
      />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-surface p-8 shadow-lg">
        <h1 className="text-xl font-semibold text-slate-900">Create your workspace</h1>
        <p className="mt-1 text-sm text-slate-500">
          Start running your business with an AI powered operating system.
        </p>

        <form action={action} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="companyName">Company name</Label>
            <Input id="companyName" name="companyName" placeholder="Acme Retail Co." required />
            <FieldError messages={state?.errors?.companyName} />
          </div>
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input id="name" name="name" placeholder="Jane Doe" required />
            <FieldError messages={state?.errors?.name} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@company.com" required />
            <FieldError messages={state?.errors?.email} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
            <FieldError messages={state?.errors?.password} />
          </div>

          {state?.message && (
            <p className="text-sm text-red-600">{state.message}</p>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
