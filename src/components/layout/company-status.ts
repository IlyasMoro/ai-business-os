import { daysLeft } from "@/lib/date-utils";
import { formatDayMonth } from "@/lib/utils";

export type CompanyCard = {
  subscription: Subscription;
  planName: string;
  logoUrl: string | null;
};

export type Subscription = {
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd: boolean;
} | null;

/** Where the company stands: the plan it's on, then the trial countdown or a
 * problem to fix. `tone` colours it: warn when attention is needed soon, bad
 * when access is at risk. `text` is null when there is nothing to add. */
export function statusLine(subscription: Subscription): { text: string | null; short?: string; tone: "ok" | "warn" | "bad" } {
  const now = new Date();
  if (subscription?.status === "TRIALING") {
    if (subscription.trialEndsAt && subscription.trialEndsAt <= now) return { text: "Trial ended", tone: "bad" };
    if (!subscription.trialEndsAt) return { text: "Free trial", tone: "ok" };
    const left = daysLeft(subscription.trialEndsAt);
    if (left <= 1) return { text: left === 0 ? "Trial ends today" : "Trial ends tomorrow", tone: "warn" };
    return { text: `Trial, ${left} days left`, short: `${left} days left`, tone: left <= 3 ? "warn" : "ok" };
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
