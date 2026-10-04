import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { daysLeft } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

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

/** One short line on where the company stands: the plan it's on, then the
 * trial countdown or a problem to fix. `tone` colours it: warn when
 * attention is needed soon, bad when access is at risk. */
function statusLine(subscription: Subscription, planName: string): { text: string; tone: "ok" | "warn" | "bad" } {
  const now = new Date();
  const plan = `${planName} plan`;
  if (subscription?.status === "TRIALING") {
    if (subscription.trialEndsAt && subscription.trialEndsAt <= now) return { text: `${plan} · Trial ended`, tone: "bad" };
    if (!subscription.trialEndsAt) return { text: `${plan} · Free trial`, tone: "ok" };
    const left = daysLeft(subscription.trialEndsAt);
    if (left <= 1) return { text: `${plan} · ${left === 0 ? "Trial ends today" : "Trial ends tomorrow"}`, tone: "warn" };
    return { text: `${plan} · Trial · ${left} days left`, tone: left <= 3 ? "warn" : "ok" };
  }
  if (subscription?.status === "PAST_DUE") return { text: `${plan} · Payment failed`, tone: "bad" };
  if (subscription?.status === "CANCELED" || subscription?.status === "INCOMPLETE") {
    return { text: "No active plan", tone: "bad" };
  }
  if (subscription?.status === "ACTIVE" && subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd) {
    const date = subscription.currentPeriodEnd.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
    return { text: `${plan} · cancels ${date}`, tone: "warn" };
  }
  return { text: plan, tone: "ok" };
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
  const status = statusLine(subscription, planName);
  const toneClass = {
    ok: "text-slate-400 light:text-slate-500",
    warn: "text-amber-400 light:text-amber-600",
    bad: "text-red-400 light:text-red-600",
  }[status.tone];

  const body = (
    <>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-md bg-white object-contain p-0.5" />
      ) : (
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-xs font-semibold text-white"
        >
          {initials(companyName)}
        </span>
      )}
      <span className="min-w-0 leading-tight">
        <span className="block max-w-[11rem] truncate text-sm font-semibold text-slate-50 sm:max-w-[16rem] light:text-slate-900">
          {companyName}
        </span>
        <span className={cn("flex max-w-[11rem] items-center gap-1.5 text-[11.5px] sm:max-w-[16rem]", toneClass)} title={status.text}>
          {status.tone !== "ok" && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
          <span className="truncate">{status.text}</span>
        </span>
      </span>
      {canManage && (
        <ChevronRight
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 light:text-slate-400"
        />
      )}
    </>
  );

  const shell =
    "group flex min-w-0 items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-2.5 backdrop-blur-md light:border-slate-200 light:bg-slate-100/70";

  return canManage ? (
    <Link
      href="/dashboard/billing"
      title="Plan and billing"
      className={cn(
        shell,
        "transition-colors hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 light:hover:border-slate-300"
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}
