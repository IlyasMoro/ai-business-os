"use client";

import { Suspense, useActionState, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fingerprint, Loader2, Mail } from "lucide-react";
import { browserSupportsWebAuthn, startAuthentication, WebAuthnError } from "@simplewebauthn/browser";
import { login } from "@/lib/actions/auth";
import { AuthAlert, AuthField, AuthSubmit, PasswordField, authLink } from "@/components/auth/auth-fields";

/** Where the email is kept when "Keep me signed in" was ticked, in this browser only. */
const EMAIL_KEY = "aibos_login_email";

const noSubscribe = () => () => {};
function readSavedEmail(): string | null {
  try {
    return localStorage.getItem(EMAIL_KEY);
  } catch {
    return null; // Storage blocked (private window): the form works without it.
  }
}

export type LoginProvider = { id: "google" | "microsoft"; label: string };

/** Sign in with a passkey: the device offers the passkeys it has for this
    site and checks the person's fingerprint, face or PIN. Cancelling the
    device's prompt is not an error, so it says nothing. */
function PasskeyButton() {
  const supported = useSyncExternalStore(noSubscribe, () => browserSupportsWebAuthn(), () => false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!supported) return null;

  async function signIn() {
    setBusy(true);
    setMessage(null);
    try {
      const options = await fetch("/api/auth/passkey/login/options", { method: "POST" }).then((r) => r.json());
      if (options.error) {
        setMessage(options.error);
        return;
      }
      const response = await startAuthentication({ optionsJSON: options });
      const result = await fetch("/api/auth/passkey/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      }).then((r) => r.json());
      if (result.ok) {
        window.location.assign(result.redirect ?? "/dashboard");
        return;
      }
      setMessage(result.error ?? "That passkey didn't work. Try again.");
    } catch (error) {
      const cancelled =
        (error instanceof WebAuthnError && error.code === "ERROR_CEREMONY_ABORTED") ||
        (error instanceof Error && error.name === "NotAllowedError");
      if (!cancelled) setMessage("That passkey didn't work. Try again, or use your email and password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="my-5 flex items-center gap-3 text-xs font-medium text-slate-400" aria-hidden>
        <span className="h-px flex-1 bg-slate-200" />
        or
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      {message && (
        <div className="mb-4">
          <AuthAlert tone="error">{message}</AuthAlert>
        </div>
      )}
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-5 py-3 text-[0.95rem] font-semibold text-[#0b1f5e] transition hover:border-[#0b1f5e] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/30 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Fingerprint className="h-[1.1rem] w-[1.1rem] text-cyan-600" aria-hidden />}
        {busy ? "Waiting for your device" : "Sign in with a passkey"}
      </button>
    </div>
  );
}

/* Messages from the address bar: a finished password reset, an expired
   second step, or a Google / Microsoft sign in that could not finish. */
const NOTICES: Record<string, { tone: "error" | "success"; text: string }> = {
  "reset:success": { tone: "success", text: "Your password has been reset. Sign in with your new password." },
  "expired:1": { tone: "error", text: "That sign in took too long or had too many wrong codes. Start again." },
  "oauth:failed": { tone: "error", text: "Signing in didn't finish. Try again, or use your email and password." },
  "oauth:no-account": { tone: "error", text: "There is no AIBOS account for that email yet. Create one below, or ask your team owner for an invite." },
  "oauth:link-first": {
    tone: "error",
    text: "Sign in with your password once, then connect Microsoft from My account. After that the Microsoft button works.",
  },
  "oauth:locked": { tone: "error", text: "Too many failed attempts. Please try again in 15 minutes." },
  "oauth:unavailable": { tone: "error", text: "That sign in option is not available. Use your email and password." },
};

function UrlNotice() {
  const params = useSearchParams();
  const key = ["reset", "expired", "oauth"].map((k) => `${k}:${params.get(k)}`).find((k) => k in NOTICES);
  if (!key) return null;
  return (
    <div className="mb-6">
      <AuthAlert tone={NOTICES[key].tone}>{NOTICES[key].text}</AuthAlert>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.1rem] w-[1.1rem]" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.05rem] w-[1.05rem]" aria-hidden>
      <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
      <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
      <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
      <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
    </svg>
  );
}

/** The sign in form, in two steps: the email first (with Google /
    Microsoft above it when set up), then the password with Caps Lock
    warning and "Keep me signed in". A remembered email starts at the
    password. The email stays filled in after a wrong password.
    Which step comes next never depends on whether the email has an
    account, so the form gives nothing away about who uses AIBOS. */
export function LoginForm({ providers = [] }: { providers?: LoginProvider[] }) {
  const [state, action, pending] = useActionState(login, undefined);
  const saved = useSyncExternalStore(noSubscribe, readSavedEmail, () => null);
  // Controlled, so a failed attempt does not wipe the address. Until the
  // person types or ticks, the remembered email (if any) fills the form.
  const [typedEmail, setEmail] = useState<string | null>(null);
  const [rememberTicked, setRemember] = useState<boolean | null>(null);
  const email = typedEmail ?? saved ?? "";
  const remember = rememberTicked ?? Boolean(saved);
  // null until the person moves on: then the saved email decides the start.
  const [chosenStep, setStep] = useState<"email" | "password" | null>(null);
  const emailRejected = Boolean(state?.errors?.email?.length);
  const step = emailRejected ? "email" : (chosenStep ?? (saved ? "password" : "email"));

  // Each step starts with its own box focused.
  useEffect(() => {
    document.getElementById(step === "password" ? "password" : "email")?.focus();
  }, [step]);

  /** Continue: check the email looks right (the browser's own message if
      not), then show the password step. */
  function next() {
    const input = document.getElementById("email") as HTMLInputElement | null;
    if (input && !input.reportValidity()) return;
    setStep("password");
  }

  function rememberChoice() {
    try {
      if (remember && email) localStorage.setItem(EMAIL_KEY, email.trim());
      else localStorage.removeItem(EMAIL_KEY);
    } catch {
      // Remembering the email is a convenience only.
    }
  }

  return (
    <div>
      <Suspense fallback={null}>
        <UrlNotice />
      </Suspense>

      {state?.message && (
        <div className="mb-6">
          <AuthAlert tone="error">{state.message}</AuthAlert>
        </div>
      )}

      {providers.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {providers.map((p) => (
              // A plain link: the browser leaves for the provider and comes back.
              <a
                key={p.id}
                href={`/api/auth/oauth/${p.id}${remember ? "?remember=1" : ""}`}
                className="flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1b3fbf]/20"
              >
                {p.id === "google" ? <GoogleMark /> : <MicrosoftMark />}
                {p.label}
              </a>
            ))}
          </div>
          <div className="my-6 flex items-center gap-3 text-xs font-medium text-slate-400" aria-hidden>
            <span className="h-px flex-1 bg-slate-200" />
            or with your email
            <span className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      )}

      <form
        action={action}
        onSubmit={(e) => {
          // Enter in the email box moves on instead of signing in.
          if (step === "email") {
            e.preventDefault();
            next();
            return;
          }
          rememberChoice();
        }}
        className="space-y-5"
      >
        {step === "email" ? (
          <>
            <AuthField
              id="email"
              type="email"
              label="Work email"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="username"
              required
              errors={state?.errors?.email}
            />
            <AuthSubmit pending={false} pendingText="">
              Continue
            </AuthSubmit>
          </>
        ) : (
          <>
            {/* The email being signed in, with a way back to change it. It is
                still a real field, so password managers match the login. */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="flex min-w-0 items-center gap-2.5 text-sm text-slate-700">
                <Mail className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <span className="truncate font-medium">{email}</span>
              </span>
              <button type="button" onClick={() => setStep("email")} className={`shrink-0 text-sm ${authLink}`}>
                Change
              </button>
            </div>
            <input type="email" name="email" value={email} readOnly autoComplete="username" className="sr-only" tabIndex={-1} aria-hidden />

            <PasswordField
              autoComplete="current-password"
              placeholder="Your password"
              errors={state?.errors?.password}
              labelAside={
                <Link href="/forgot-password" className={`mb-1.5 text-sm ${authLink}`}>
                  Forgot password?
                </Link>
              }
            />

            <label className="flex w-fit cursor-pointer select-none items-start gap-2.5 text-sm text-slate-600">
              <input
                type="checkbox"
                name="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#1b3fbf]"
              />
              <span>
                Keep me signed in for 30 days
                <span className="block text-xs text-slate-400">Only on your own device.</span>
              </span>
            </label>

            <AuthSubmit pending={pending} pendingText="Signing in">
              Sign in
            </AuthSubmit>
          </>
        )}
      </form>
      {step === "email" && <PasskeyButton />}
      {/* Signing up is offered once, in the top corner of the page. */}
    </div>
  );
}
