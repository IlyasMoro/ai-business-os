import { ArrowDown, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export const TRIAL_DAYS = 14;

export type PlanStatus =
  | { kind: "trial"; daysLeft: number }
  | { kind: "trialEnded" }
  | { kind: "active"; planLabel: string; renewsOn: Date | null; cancelling: boolean }
  | { kind: "pastDue"; planLabel: string }
  | { kind: "none" };

/**
 * The first thing on Billing, big and plain: how long the trial has left
 * (with a bar of the 14 days), or the plan you're on and when it renews, or
 * what needs fixing. Amber in the last three days of a trial, red when
 * access is at risk. The button jumps to the plans.
 */
export function PlanStatusHero({ status }: { status: PlanStatus }) {
  const tone =
    status.kind === "trialEnded" || status.kind === "pastDue" || status.kind === "none"
      ? "bad"
      : status.kind === "trial" && status.daysLeft <= 3
        ? "warn"
        : status.kind === "active"
          ? "good"
          : "info";

  const frame = {
    info: "border-blue-500/40 from-blue-600/25 via-blue-500/10 to-transparent light:from-blue-100 light:via-blue-50",
    warn: "border-amber-500/50 from-amber-500/25 via-amber-500/10 to-transparent light:from-amber-100 light:via-amber-50",
    bad: "border-red-500/50 from-red-600/25 via-red-500/10 to-transparent light:from-red-100 light:via-red-50",
    good: "border-emerald-500/40 from-emerald-600/20 via-emerald-500/5 to-transparent light:from-emerald-100 light:via-emerald-50",
  }[tone];
  const accent = { info: "text-blue-300 light:text-blue-700", warn: "text-amber-300 light:text-amber-700", bad: "text-red-300 light:text-red-700", good: "text-emerald-300 light:text-emerald-700" }[tone];
  const bar = { info: "bg-blue-500", warn: "bg-amber-500", bad: "bg-red-500", good: "bg-emerald-500" }[tone];
  const Icon = tone === "good" ? CheckCircle2 : tone === "bad" ? AlertTriangle : Clock;

  let eyebrow: string;
  let headline: React.ReactNode;
  let detail: string;
  let cta: string | null = "Choose your plan";
  switch (status.kind) {
    case "trial":
      eyebrow = "Free trial with every module";
      headline = (
        <>
          <span className="tabular-nums">{status.daysLeft}</span> {status.daysLeft === 1 ? "day" : "days"} left
        </>
      );
      detail =
        status.daysLeft <= 3
          ? "Your trial ends soon. Pick a plan now so nothing stops working."
          : "Everything is unlocked while you try AIBOS. Pick a plan any time before it ends.";
      break;
    case "trialEnded":
      eyebrow = "Free trial";
      headline = "Your trial has ended";
      detail = "Choose a plan to keep using AIBOS. Your data is safe and waiting.";
      break;
    case "pastDue":
      eyebrow = status.planLabel;
      headline = "Payment failed";
      detail = "Update your card in Manage billing below so your plan stays active.";
      cta = null;
      break;
    case "none":
      eyebrow = "No active plan";
      headline = "Choose a plan to continue";
      detail = "Subscribe below to get your team back in.";
      break;
    case "active":
      eyebrow = "Your plan";
      headline = status.planLabel;
      detail = status.cancelling
        ? `Cancels${status.renewsOn ? ` on ${status.renewsOn.toLocaleDateString()}` : " at the end of this period"}.`
        : status.renewsOn
          ? `Active, renews on ${status.renewsOn.toLocaleDateString()}.`
          : "Active.";
      cta = "Change plan";
      break;
  }

  const usedPct = status.kind === "trial" ? Math.min(100, Math.max(4, ((TRIAL_DAYS - status.daysLeft) / TRIAL_DAYS) * 100)) : null;

  return (
    <section
      aria-label="Your subscription"
      className={cn("relative mt-6 overflow-hidden rounded-2xl border bg-gradient-to-br p-6 sm:p-8", frame)}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className={cn("mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 light:bg-white", accent)} aria-hidden>
            <Icon className="h-6 w-6" />
          </span>
          <div>
            <p className={cn("text-xs font-semibold uppercase tracking-wider", accent)}>{eyebrow}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl light:text-slate-900">{headline}</p>
            <p className="mt-2 max-w-xl text-sm text-slate-300 light:text-slate-600">{detail}</p>
          </div>
        </div>
        {cta && (
          <a
            href="#plans"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
              tone === "bad" ? "bg-red-600 hover:bg-red-500" : tone === "warn" ? "bg-amber-600 hover:bg-amber-500" : "bg-blue-600 hover:bg-blue-500"
            )}
          >
            {cta}
            <ArrowDown className="h-4 w-4" aria-hidden />
          </a>
        )}
      </div>
      {usedPct !== null && status.kind === "trial" && (
        <div className="mt-6">
          <div
            className="h-2 overflow-hidden rounded-full bg-white/10 light:bg-slate-900/10"
            role="progressbar"
            aria-label="Trial used"
            aria-valuemin={0}
            aria-valuemax={TRIAL_DAYS}
            aria-valuenow={TRIAL_DAYS - status.daysLeft}
          >
            <div className={cn("h-full rounded-full", bar)} style={{ width: `${usedPct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-slate-400 light:text-slate-500">
            Day {Math.min(TRIAL_DAYS, TRIAL_DAYS - status.daysLeft + 1)} of {TRIAL_DAYS}
          </p>
        </div>
      )}
    </section>
  );
}
