import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { daysLeft } from "@/lib/date-utils";
import { cn, formatDayMonth } from "@/lib/utils";

type Subscription = {
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd: boolean;
} | null;

/** "AB" from "Acme Brands (Pty) Ltd": the first letters of the first two words. */
function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? "?").toUpperCase() + (words[1]?.[0] ?? "").toUpperCase();
}

/** Where the company stands: the plan it's on, then the trial countdown or a
 * problem to fix. `tone` colours it: warn when attention is needed soon, bad
 * when access is at risk. `text` is null when there is nothing to add. */
function statusLine(subscription: Subscription): { text: string | null; tone: "ok" | "warn" | "bad" } {
  const now = new Date();
  if (subscription?.status === "TRIALING") {
    if (subscription.trialEndsAt && subscription.trialEndsAt <= now) return { text: "Trial ended", tone: "bad" };
    if (!subscription.trialEndsAt) return { text: "Free trial", tone: "ok" };
    const left = daysLeft(subscription.trialEndsAt);
    if (left <= 1) return { text: left === 0 ? "Trial ends today" : "Trial ends tomorrow", tone: "warn" };
    return { text: `Trial, ${left} days left`, tone: left <= 3 ? "warn" : "ok" };
  }
  if (subscription?.status === "PAST_DUE") return { text: "Payment failed", tone: "bad" };
  if (subscription?.status === "CANCELED" || subscription?.status === "INCOMPLETE") {
    return { text: "No active plan", tone: "bad" };
  }
  if (subscription?.status === "ACTIVE" && subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd) {
    const date = formatDayMonth(subscription.currentPeriodEnd);
    return { text: `Cancels ${date}`, tone: "warn" };
  }
  return { text: null, tone: "ok" };
}

/**
 * Top bar badge for the signed-in company: its logo (or initials), name,
 * and one status line. For owners the whole badge opens Billing; other
 * roles can't open Billing, so for them it is information only.
 */
export function CompanyStatusBadge({
  companyName,
  subscription,
  planName,
  logoUrl,
  canManage,
}: {
  companyName: string;
  subscription: Subscription;
  planName: string;
  /** The uploaded logo, or null to show initials. */
  logoUrl: string | null;
  /** Owners can open Billing. */
  canManage: boolean;
}) {
  const status = statusLine(subscription);
  const noPlan = status.text === "No active plan";
  const toneClass = {
    ok: "text-slate-400 light:text-slate-600",
    warn: "text-amber-300 light:text-amber-700",
    bad: "text-red-300 light:text-red-700",
  }[status.tone];
  const summary = [noPlan ? null : `${planName} plan`, status.text].filter(Boolean).join(", ");

  const body = (
    <>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-0.5" />
      ) : (
        <span
          aria-hidden
          className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#3e5a80] to-[#2a3d5c] text-sm font-semibold tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-white/10"
        >
          {initials(companyName)}
        </span>
      )}
      <span className="hidden min-w-0 sm:block" title={summary}>
        <span className="font-display block max-w-[11rem] truncate text-[15px] font-semibold leading-5 text-white sm:max-w-[16rem] light:text-slate-900">
          {companyName}
        </span>
        <span className="mt-1 flex max-w-[11rem] items-center gap-1.5 text-xs leading-4 sm:max-w-[16rem]">
          {!noPlan && (
            <span className="shrink-0 rounded-full bg-blue-200 px-2.5 py-0.5 font-semibold text-[#0b1f5e] light:bg-blue-100 light:text-blue-800">
              {planName}
            </span>
          )}
          {status.text && (
            <span className={cn("flex min-w-0 items-center gap-1.5 tabular-nums", toneClass)}>
              {/* A dot ahead of the status: grey when all is well, the
                  status colour when it needs attention. */}
              <span
                aria-hidden
                className={cn("h-1 w-1 shrink-0 rounded-full", status.tone === "ok" ? "bg-slate-500" : "h-1.5 w-1.5 bg-current")}
              />
              <span className="truncate">{status.text}</span>
            </span>
          )}
        </span>
      </span>
      {canManage && (
        <ChevronRight
          aria-hidden
          className="hidden h-4 w-4 shrink-0 sm:block text-slate-400 transition-transform group-hover:translate-x-0.5 light:text-slate-400"
        />
      )}
    </>
  );

  const shell =
    "group flex min-w-0 shrink-0 items-center gap-3 rounded-2xl border border-white/[0.1] bg-[#1b2232]/80 p-1 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur sm:py-1.5 sm:pl-1.5 sm:pr-3.5 light:border-slate-200 light:bg-white";

  return canManage ? (
    <Link
      href="/dashboard/billing"
      title="Plan and billing"
      aria-label={`${companyName}, ${summary}. Plan and billing`}
      className={cn(
        shell,
        "hover:border-white/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 light:hover:border-slate-300"
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={shell} aria-label={`${companyName}, ${summary}`} role="group">
      {body}
    </div>
  );
}
