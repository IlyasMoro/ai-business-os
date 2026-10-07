"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* Form parts for the public forms (sign in, sign up, password reset,
   invites, contact), on the white side of AuthShell. */

export const authLink = "font-semibold text-[#1b3fbf] transition hover:text-[#0b1f5e] hover:underline";

const fieldBase =
  "block w-full rounded-xl border border-slate-200 bg-slate-50/60 py-3 pl-11 pr-3 text-[0.95rem] text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#1b3fbf] focus:bg-white focus:ring-4 focus:ring-[#1b3fbf]/10 aria-[invalid=true]:border-red-400";
/** A dark glass box without an icon (numbers, messages). */
export const authPlainField = cn(fieldBase, "px-3.5");
export const authLabel = "mb-1.5 block text-sm font-semibold text-[#0b1f5e]";
const labelClass = authLabel;
const iconClass = "pointer-events-none absolute left-3.5 top-1/2 h-[1.15rem] w-[1.15rem] -translate-y-1/2 text-slate-400";

function ErrorText({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-red-600">
      {messages[0]}
    </p>
  );
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "name"> & {
  id: string;
  name?: string;
  label: string;
  icon: LucideIcon;
  errors?: string[];
  /** Small text under the field, shown while there is no error. */
  hint?: ReactNode;
  /** Something on the label row's right, such as "Forgot password?". */
  labelAside?: ReactNode;
};

export function AuthField({ id, name, label, icon: Icon, errors, hint, labelAside, className, ...input }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        {labelAside}
      </div>
      <div className="relative">
        <Icon className={iconClass} aria-hidden />
        <input
          id={id}
          name={name ?? id}
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={errors?.length ? errorId : undefined}
          className={cn(fieldBase, className)}
          {...input}
        />
      </div>
      {errors?.length ? <ErrorText id={errorId} messages={errors} /> : hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** How strong a new password looks: 0 (too short) to 4. Length matters most. */
export function passwordScore(password: string): number {
  if (password.length < 8) return 0;
  let score = 1;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  else if (/\d|[^A-Za-z0-9]/.test(password)) score += 0.5;
  return Math.min(4, Math.floor(score));
}

const STRENGTH = [
  { label: "Too short", bar: "bg-red-500", text: "text-red-600" },
  { label: "Weak", bar: "bg-orange-500", text: "text-orange-600" },
  { label: "Fair", bar: "bg-amber-400", text: "text-amber-600" },
  { label: "Good", bar: "bg-emerald-500", text: "text-emerald-600" },
  { label: "Strong", bar: "bg-emerald-500", text: "text-emerald-600" },
];

/** Password box with show/hide, a Caps Lock warning and, for new
    passwords, a strength meter. */
export function PasswordField({
  id = "password",
  label = "Password",
  autoComplete,
  placeholder,
  errors,
  labelAside,
  showStrength = false,
}: {
  id?: string;
  label?: string;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  errors?: string[];
  labelAside?: ReactNode;
  showStrength?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [value, setValue] = useState("");
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const score = passwordScore(value);
  const describedBy = [errors?.length ? errorId : "", capsLock || showStrength ? hintId : ""].filter(Boolean).join(" ");

  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        {labelAside}
      </div>
      <div className="relative">
        <Lock className={iconClass} aria-hidden />
        <input
          id={id}
          name={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          minLength={showStrength ? 8 : undefined}
          onChange={(e) => setValue(e.target.value)}
          onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
          onBlur={() => setCapsLock(false)}
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(fieldBase, "pr-12")}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b3fbf]/40"
        >
          {show ? <EyeOff className="h-[1.1rem] w-[1.1rem]" /> : <Eye className="h-[1.1rem] w-[1.1rem]" />}
        </button>
      </div>
      <ErrorText id={errorId} messages={errors} />
      <div id={hintId}>
        {capsLock && <p className="mt-1.5 text-sm font-medium text-amber-600">Caps Lock is on.</p>}
        {showStrength && (
          <div className="mt-2.5">
            <div className="flex gap-1.5" aria-hidden>
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={cn("h-1 flex-1 rounded-full transition-colors", value && score >= i ? STRENGTH[score].bar : "bg-slate-200")}
                />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {value ? <span className={cn("font-semibold", STRENGTH[score].text)}>{STRENGTH[score].label}. </span> : null}
              At least 8 characters. A longer phrase is stronger.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function AuthSubmit({ pending, pendingText, children }: { pending: boolean; pendingText: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      // Glass: see through navy, a shine across the top half, a bright
      // edge and a soft glow; on hover a light sweep runs across it.
      className="group relative isolate flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-white/15 bg-[linear-gradient(180deg,rgba(14,36,108,0.97),rgba(7,21,66,0.98))] px-5 py-3.5 text-[0.95rem] font-semibold text-white shadow-[0_14px_32px_-12px_rgba(11,31,94,0.7),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.3)] backdrop-blur-md transition hover:-translate-y-px hover:shadow-[0_18px_38px_-12px_rgba(11,31,94,0.8),inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(0,0,0,0.3)] hover:brightness-115 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1b3fbf]/30 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transition-none"
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-1/2 bg-gradient-to-b from-white/10 to-white/0" aria-hidden />
      <span
        className="pointer-events-none absolute inset-y-0 -left-1/3 -z-10 w-1/3 -skew-x-12 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-all duration-700 group-hover:left-[110%] group-hover:opacity-100 motion-reduce:hidden"
        aria-hidden
      />
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {pendingText}
        </>
      ) : (
        <>
          {children}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </>
      )}
    </button>
  );
}

export function AuthAlert({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm",
        tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
