"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Building2, Mail, User } from "lucide-react";
import { register } from "@/lib/actions/auth";
import { AuthAlert, AuthField, AuthSubmit, PasswordField, authLink } from "@/components/auth/auth-fields";

/** The sign up form. Fields are controlled so a failed attempt keeps what
    was typed (only the password is cleared). */
export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);
  const [values, setValues] = useState({ companyName: "", name: "", email: "" });
  const bind = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: e.target.value })),
  });

  return (
    <form action={action} className="space-y-5">
      {state?.message && <AuthAlert tone="error">{state.message}</AuthAlert>}

      <AuthField
        id="companyName"
        label="Company name"
        icon={Building2}
        placeholder="Good Hope Butchery"
        autoComplete="organization"
        autoFocus
        required
        errors={state?.errors?.companyName}
        {...bind("companyName")}
      />
      <AuthField
        id="name"
        label="Your name"
        icon={User}
        placeholder="Your full name"
        autoComplete="name"
        required
        errors={state?.errors?.name}
        {...bind("name")}
      />
      <AuthField
        id="email"
        type="email"
        label="Work email"
        icon={Mail}
        placeholder="you@company.com"
        autoComplete="email"
        required
        errors={state?.errors?.email}
        {...bind("email")}
      />
      <PasswordField autoComplete="new-password" placeholder="Choose a password" errors={state?.errors?.password} showStrength />

      <AuthSubmit pending={pending} pendingText="Creating your workspace">
        Create account
      </AuthSubmit>

      <p className="text-center text-xs leading-relaxed text-slate-500">
        By creating an account you agree to our{" "}
        <Link href="/terms" className={authLink}>
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className={authLink}>
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}
