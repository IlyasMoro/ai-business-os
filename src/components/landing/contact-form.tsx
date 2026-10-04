"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Send } from "lucide-react";
import { publicField, publicLabel } from "@/components/public/customer-shell";
import { HONEYPOT_FIELD } from "@/lib/lead-form";
import { CONTACT_TOPICS, type ContactFormState, type ContactTopicId } from "@/lib/contact";
import { submitContactMessage } from "@/lib/actions/contact";
import { cn } from "@/lib/utils";
import styles from "@/components/landing/landing.module.css";

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

/** The public contact form: topic chips first, then the details. Enterprise
 * questions also ask for team size and branches, so a quote can start from
 * numbers. */
export function ContactForm({ topic: initialTopic }: { topic: ContactTopicId }) {
  const [state, formAction, pending] = useActionState<ContactFormState, FormData>(submitContactMessage, undefined);
  const [topic, setTopic] = useState<ContactTopicId>(initialTopic);
  // When the page was opened, for the "too fast to be a person" check.
  const [startedAt] = useState(() => Date.now());

  if (state?.ok) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-600" aria-hidden />
        <p className="mt-4 text-lg font-semibold text-slate-900">Thank you, we have your message.</p>
        <p className="mt-1 max-w-sm text-sm text-slate-600">We reply by email, usually within one working day.</p>
      </div>
    );
  }

  const e = state?.errors;
  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="startedAt" value={startedAt} />
      {/* Hidden from people; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={HONEYPOT_FIELD}>Website</label>
        <input id={HONEYPOT_FIELD} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <fieldset>
        <legend className={publicLabel}>What is it about?</legend>
        <div className="flex flex-wrap gap-2">
          {CONTACT_TOPICS.map((t) => (
            <span key={t.id}>
              <input
                type="radio"
                id={`topic-${t.id}`}
                name="topic"
                value={t.id}
                checked={topic === t.id}
                onChange={() => setTopic(t.id)}
                className={cn(styles.chipInput, "sr-only")}
              />
              <label htmlFor={`topic-${t.id}`} className={styles.chip}>
                {t.label}
              </label>
            </span>
          ))}
        </div>
        {e?.topic?.[0] && <p className="mt-1 text-sm text-red-600">{e.topic[0]}</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Name" error={e?.name}>
          <input id="name" name="name" required autoComplete="name" maxLength={100} className={publicField} />
        </Field>
        <Field id="email" label="Email" error={e?.email}>
          <input id="email" name="email" type="email" required autoComplete="email" maxLength={200} className={publicField} />
        </Field>
      </div>
      <Field id="company" label="Company" optional error={e?.company}>
        <input id="company" name="company" autoComplete="organization" maxLength={150} className={publicField} />
      </Field>

      {topic === "ENTERPRISE" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="teamSize" label="Team size" optional error={e?.teamSize}>
            <input id="teamSize" name="teamSize" type="number" inputMode="numeric" min={1} max={100000} placeholder="For example 60" className={publicField} />
          </Field>
          <Field id="branches" label="Branches" optional error={e?.branches}>
            <input id="branches" name="branches" type="number" inputMode="numeric" min={1} max={10000} placeholder="For example 4" className={publicField} />
          </Field>
        </div>
      )}

      <Field id="message" label="Message" error={e?.message}>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          maxLength={4000}
          placeholder={
            topic === "ENTERPRISE"
              ? "Tell us what you need: contracts, invoicing instead of a card, modules, timing."
              : "Tell us about your business and what you need."
          }
          className={publicField}
        />
      </Field>

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      <div>
        <button type="submit" disabled={pending} className={cn(styles.btn, styles.sendBtn)}>
          <Send className="h-4 w-4" aria-hidden />
          {pending ? "Sending..." : "Send message"}
        </button>
        <p className="mt-3 text-center text-xs text-slate-500">
          We only use your details to reply to you.{" "}
          <Link href="/privacy" className="font-semibold text-[#0b1f5e] underline">
            Privacy policy
          </Link>
        </p>
      </div>
    </form>
  );
}
