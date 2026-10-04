"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { publicButton, publicField, publicLabel } from "@/components/public/customer-shell";
import { HONEYPOT_FIELD } from "@/lib/lead-form";
import type { LeadFormState } from "./actions";

type Action = (state: LeadFormState, formData: FormData) => Promise<LeadFormState>;

function Field({ id, label, error, optional, children }: { id: string; label: string; error?: string[]; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={publicLabel}>
        {label}
        {optional && <span className="font-normal text-slate-400"> (optional)</span>}
      </label>
      {children}
      {error?.[0] && <p className="mt-1 text-sm text-red-600">{error[0]}</p>}
    </div>
  );
}

export function LeadForm({ action, thanks }: { action: Action; thanks: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  // When the page was opened, for the "too fast to be a person" check.
  const [startedAt] = useState(() => Date.now());

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden />
        <p className="mt-4 max-w-sm text-base text-slate-700">{thanks}</p>
      </div>
    );
  }

  const e = state?.errors;
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="startedAt" value={startedAt} />
      {/* Hidden from people; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={HONEYPOT_FIELD}>Website</label>
        <input id={HONEYPOT_FIELD} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Name" error={e?.name}>
          <input id="name" name="name" required autoComplete="name" maxLength={120} className={publicField} />
        </Field>
        <Field id="email" label="Email" error={e?.email}>
          <input id="email" name="email" type="email" required autoComplete="email" maxLength={200} className={publicField} />
        </Field>
        <Field id="phone" label="Phone" optional error={e?.phone}>
          <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={40} className={publicField} />
        </Field>
        <Field id="company" label="Company" optional error={e?.company}>
          <input id="company" name="company" autoComplete="organization" maxLength={120} className={publicField} />
        </Field>
      </div>
      <Field id="message" label="How can we help?" optional error={e?.message}>
        <textarea id="message" name="message" rows={4} maxLength={3000} className={publicField} />
      </Field>

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      <button type="submit" disabled={pending} className={publicButton + " w-full sm:w-auto"}>
        {pending ? "Sending..." : "Send message"}
      </button>
    </form>
  );
}
