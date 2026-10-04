"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { publicButton, publicField, publicLabel } from "@/components/public/customer-shell";
import { HONEYPOT_FIELD } from "@/lib/lead-form";
import { CONTACT_TOPICS, type ContactFormState, type ContactTopicId } from "@/lib/contact";
import { submitContactMessage } from "@/lib/actions/contact";

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

/** The public contact form; the page is white, so it uses the light field styles. */
export function ContactForm({ topic }: { topic: ContactTopicId }) {
  const [state, formAction, pending] = useActionState<ContactFormState, FormData>(submitContactMessage, undefined);
  // When the page was opened, for the "too fast to be a person" check.
  const [startedAt] = useState(() => Date.now());

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-600" aria-hidden />
        <p className="mt-4 text-lg font-semibold text-slate-900">Thank you, we have your message.</p>
        <p className="mt-1 max-w-sm text-sm text-slate-600">We reply by email, usually within one working day.</p>
      </div>
    );
  }

  const e = state?.errors;
  return (
    // "light" gives the topic dropdown its dark arrow and white option list on this white page.
    <form action={formAction} className="light space-y-4">
      <input type="hidden" name="startedAt" value={startedAt} />
      {/* Hidden from people; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={HONEYPOT_FIELD}>Website</label>
        <input id={HONEYPOT_FIELD} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Name" error={e?.name}>
          <input id="name" name="name" required autoComplete="name" maxLength={100} className={publicField} />
        </Field>
        <Field id="email" label="Email" error={e?.email}>
          <input id="email" name="email" type="email" required autoComplete="email" maxLength={200} className={publicField} />
        </Field>
        <Field id="company" label="Company" optional error={e?.company}>
          <input id="company" name="company" autoComplete="organization" maxLength={150} className={publicField} />
        </Field>
        <Field id="topic" label="What is it about?" error={e?.topic}>
          <select id="topic" name="topic" defaultValue={topic} className={publicField}>
            {CONTACT_TOPICS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field id="message" label="Message" error={e?.message}>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          maxLength={4000}
          placeholder="Tell us about your business and what you need, for example your team size and number of branches."
          className={publicField}
        />
      </Field>

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      <button type="submit" disabled={pending} className={publicButton}>
        {pending ? "Sending..." : "Send message"}
      </button>
    </form>
  );
}
