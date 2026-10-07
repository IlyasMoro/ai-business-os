"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Check,
  CheckCircle2,
  Mail,
  MessageCircle,
  Tag,
  User,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { HONEYPOT_FIELD } from "@/lib/lead-form";
import {
  asksForSize,
  CONTACT_TOPICS,
  type ContactFormState,
  type ContactTopicId,
} from "@/lib/contact";
import { CUSTOM_PLAN, recommendedPlan } from "@/lib/plans";
import { submitContactMessage } from "@/lib/actions/contact";
import { cn } from "@/lib/utils";
import {
  AuthAlert,
  AuthField,
  AuthSubmit,
  authLabel,
  authLink,
  authPlainField,
} from "@/components/auth/auth-fields";
import styles from "@/components/landing/landing.module.css";

const TOPIC_ICONS: Record<ContactTopicId, LucideIcon> = {
  SALES: Tag,
  ENTERPRISE: Building2,
  SUPPORT: UserRound,
  OTHER: MessageCircle,
};

const PLACEHOLDERS: Record<ContactTopicId, string> = {
  SALES:
    "Tell us about your business: what you sell and which modules you need.",
  ENTERPRISE:
    "Tell us what you need: contracts, invoicing instead of a card, modules, timing.",
  SUPPORT: "What's happening, and what did you expect to happen?",
  OTHER: "How can we help?",
};

const tip =
  "rounded-xl border-l-[3px] border-l-cyan-400 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600 [&_a]:font-semibold [&_a]:text-[#0b1f5e] [&_a]:underline [&_b]:text-[#0b1f5e]";

function Field({
  id,
  label,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  error?: string[];
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={authLabel}>
        {label}
        {optional && <span className="font-normal text-slate-400"> (optional)</span>}
      </label>
      {children}
      {error?.[0] && <p className="mt-1.5 text-sm text-red-600">{error[0]}</p>}
    </div>
  );
}

/** A live suggestion from the team size and branches, by the same rules as
 * the Billing page. */
function PlanHint({ users, branches }: { users: number; branches: number }) {
  const plan = recommendedPlan(Math.max(1, users), Math.max(1, branches));
  return (
    <div className={tip}>
      {plan.id === CUSTOM_PLAN.id ? (
        <>
          <b>Enterprise fits a team this size</b>: priced per user, built on the
          Pricing page.{" "}
        </>
      ) : (
        <>
          <b>{plan.name} fits you</b>: {plan.users} users and{" "}
          {plan.branches === null
            ? "unlimited branches"
            : `${plan.branches} ${plan.branches === 1 ? "branch" : "branches"}`}{" "}
          for ${plan.monthly.toLocaleString("en-US")} a month.{" "}
        </>
      )}
      <Link href="/pricing">Compare plans</Link>
    </div>
  );
}

/** The public contact form: topic tiles first, then the details. Each topic
 * shapes the form: plan and Enterprise questions ask for team size and
 * branches (with a live plan suggestion), account questions point to the
 * password reset first. */
export function ContactForm({
  topic: initialTopic,
}: {
  topic: ContactTopicId;
}) {
  const [state, formAction, pending] = useActionState<
    ContactFormState,
    FormData
  >(submitContactMessage, undefined);
  const [topic, setTopic] = useState<ContactTopicId>(initialTopic);
  const [teamSize, setTeamSize] = useState("");
  const [branches, setBranches] = useState("");
  // When the page was opened, for the "too fast to be a person" check.
  const [startedAt] = useState(() => Date.now());

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-200">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" aria-hidden />
        </span>
        <p className="mt-5 text-lg font-semibold text-slate-900">Thank you, we have your message.</p>
        <p className="mt-1 max-w-sm text-sm text-slate-600">We reply by email, usually within one working day.</p>
      </div>
    );
  }

  const e = state?.errors;
  const sized = asksForSize(topic);
  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="startedAt" value={startedAt} />
      {/* Hidden from people; bots fill it in. */}
      <div
        aria-hidden
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor={HONEYPOT_FIELD}>Website</label>
        <input
          id={HONEYPOT_FIELD}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <fieldset>
        <legend className={authLabel}>What is it about?</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {CONTACT_TOPICS.map((t) => {
            const Icon = TOPIC_ICONS[t.id];
            const chosen = topic === t.id;
            return (
              <span key={t.id}>
                <input
                  type="radio"
                  id={`topic-${t.id}`}
                  name="topic"
                  value={t.id}
                  checked={chosen}
                  onChange={() => setTopic(t.id)}
                  className="peer sr-only"
                />
                <label
                  htmlFor={`topic-${t.id}`}
                  className={cn(
                    "relative flex h-full cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 pr-10 text-[0.9rem] leading-snug transition peer-focus-visible:ring-2 peer-focus-visible:ring-[#1b3fbf]/40",
                    chosen
                      ? "border-[#0b1f5e] bg-[#f7f9fc] shadow-[inset_0_0_0_1px_#0b1f5e]"
                      : "border-slate-200 bg-white hover:border-[#0b1f5e]"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
                      chosen ? "bg-cyan-400/15 text-[#0b1f5e]" : "bg-slate-100 text-[#0b1f5e]"
                    )}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-[#0b1f5e]">{t.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{t.desc}</span>
                  </span>
                  <span
                    className={cn(
                      "absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#0b1f5e] text-white transition",
                      chosen ? "scale-100 opacity-100" : "scale-75 opacity-0"
                    )}
                    aria-hidden
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                </label>
              </span>
            );
          })}
        </div>
        {e?.topic?.[0] && (
          <p className="mt-1.5 text-sm text-red-600">{e.topic[0]}</p>
        )}
      </fieldset>

      {/* Keyed by topic so each topic's part eases in when it changes. */}
      {(sized || topic === "SUPPORT") && (
        <div key={topic} className={cn("space-y-4", styles.topicIn)}>
          {sized && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="teamSize" label="Team size" optional error={e?.teamSize}>
                  <input
                    id="teamSize"
                    name="teamSize"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100000}
                    placeholder="For example 25"
                    value={teamSize}
                    onChange={(ev) => setTeamSize(ev.target.value)}
                    className={authPlainField}
                  />
                </Field>
                <Field id="branches" label="Branches" optional error={e?.branches}>
                  <input
                    id="branches"
                    name="branches"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={10000}
                    placeholder="For example 2"
                    value={branches}
                    onChange={(ev) => setBranches(ev.target.value)}
                    className={authPlainField}
                  />
                </Field>
              </div>
              {topic === "SALES" && Number(teamSize) > 0 && (
                <PlanHint users={Number(teamSize)} branches={Number(branches) || 1} />
              )}
            </>
          )}
          {topic === "SUPPORT" && (
            <div className={tip}>
              Can&apos;t sign in? <Link href="/forgot-password">Reset your password</Link> first, it
              only takes a minute.
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <AuthField id="name" label="Name" icon={User} required autoComplete="name" maxLength={100} placeholder="Your name" errors={e?.name} />
        <AuthField id="email" type="email" label="Email" icon={Mail} required autoComplete="email" maxLength={200} placeholder="you@company.com" errors={e?.email} />
      </div>
      <AuthField
        id="company"
        label="Company (optional)"
        icon={Building2}
        autoComplete="organization"
        maxLength={150}
        placeholder="Your company"
        errors={e?.company}
      />

      <Field id="message" label="Message" error={e?.message}>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          maxLength={4000}
          placeholder={PLACEHOLDERS[topic]}
          className={cn(authPlainField, "resize-y")}
        />
      </Field>

      {state?.message && <AuthAlert tone="error">{state.message}</AuthAlert>}

      <div>
        <AuthSubmit pending={pending} pendingText="Sending">
          Send message
        </AuthSubmit>
        <p className="mt-3 text-center text-xs text-slate-500">
          We only use your details to reply to you.{" "}
          <Link href="/privacy" className={authLink}>
            Privacy policy
          </Link>
        </p>
      </div>
    </form>
  );
}
