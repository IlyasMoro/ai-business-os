import "server-only";
import { db } from "@/lib/db";

export type SubscriptionAccess =
  | { blocked: false }
  | { blocked: true; reason: "trial_expired" | "past_due" | "canceled" };

/** Companies created before billing shipped have no Subscription row at
 * all — treat that as grandfathered access rather than locking them out. */
export async function checkSubscriptionAccess(companyId: string): Promise<SubscriptionAccess> {
  const subscription = await db.subscription.findUnique({ where: { companyId } });
  if (!subscription) {
    return { blocked: false };
  }

  if (subscription.status === "ACTIVE") {
    return { blocked: false };
  }

  if (subscription.status === "TRIALING") {
    if (!subscription.trialEndsAt || subscription.trialEndsAt > new Date()) {
      return { blocked: false };
    }
    return { blocked: true, reason: "trial_expired" };
  }

  if (subscription.status === "PAST_DUE") {
    return { blocked: true, reason: "past_due" };
  }

  return { blocked: true, reason: "canceled" };
}
