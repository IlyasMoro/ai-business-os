import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { MAX_SCALE_USERS, planById, planIncludes, type Plan, type PlanFeature, type PlanId } from "@/lib/plans";

/* Applies each company's plan (Company.plan, numbers in lib/plans.ts):
   users, branches, the Growth and Scale modules, and AI requests a month.
   Every check reads the database, so a limit holds no matter which page or
   action asks. */

export async function getCompanyPlan(companyId: string): Promise<Plan> {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { plan: true } });
  return planById((company?.plan.toLowerCase() ?? "scale") as PlanId);
}

export async function hasFeature(companyId: string, feature: PlanFeature): Promise<boolean> {
  return planIncludes((await getCompanyPlan(companyId)).id, feature);
}

/** For server actions: stop when the plan lacks the module. The module's
 * own page then explains which plan has it (components/billing/plan-gate). */
export async function requireFeature(companyId: string, feature: PlanFeature, back: string): Promise<void> {
  if (!(await hasFeature(companyId, feature))) redirect(back);
}

// ---------- Users ----------

/** Seats in use: members plus open invites, so invites can't overshoot. */
export async function seatsUsed(companyId: string): Promise<number> {
  const [members, invites] = await Promise.all([
    db.user.count({ where: { companyId } }),
    db.teamInvite.count({ where: { companyId, acceptedAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  return members + invites;
}

export async function memberCount(companyId: string): Promise<number> {
  return db.user.count({ where: { companyId } });
}

/** Members above the plan's included users: the quantity billed as extra users. */
export async function extraUsersBilled(companyId: string): Promise<number> {
  const [plan, members] = await Promise.all([getCompanyPlan(companyId), memberCount(companyId)]);
  return Math.max(0, members - plan.users);
}

/** Extra users can only be billed on a paid plan price (not a trial or the
 * old single $49 price), where the subscription has a billing period. */
export async function canBillExtraUsers(companyId: string): Promise<boolean> {
  const sub = await db.subscription.findUnique({
    where: { companyId },
    select: { status: true, stripeSubscriptionId: true, billingInterval: true },
  });
  return Boolean(sub?.stripeSubscriptionId && sub.billingInterval && sub.status === "ACTIVE");
}

/**
 * Room for one more user:
 * - "included": within the plan's users.
 * - "extra": past them, billed as an extra user ($15 a month).
 * - "needs-plan": past them, but not on a paid plan price yet.
 * - "full": at MAX_SCALE_USERS; bigger teams need an Enterprise plan.
 * Seats count open invites. `pendingInvite`: the seat checked is already
 * held by that invite.
 */
export type UserRoom = "included" | "extra" | "needs-plan" | "full";

export async function userRoom(companyId: string, { pendingInvite = false } = {}): Promise<UserRoom> {
  const [plan, seats] = await Promise.all([getCompanyPlan(companyId), seatsUsed(companyId)]);
  const used = seats - (pendingInvite ? 1 : 0);
  if (used >= MAX_SCALE_USERS) return "full";
  if (used < plan.users) return "included";
  return (await canBillExtraUsers(companyId)) ? "extra" : "needs-plan";
}

// ---------- Branches ----------

export async function activeBranchCount(companyId: string): Promise<number> {
  return db.branch.count({ where: { companyId, active: true } });
}

/** Room for one more active branch. Inactive branches don't count, so a
 * company can close one branch and open another. */
export async function canAddBranch(companyId: string): Promise<boolean> {
  const plan = await getCompanyPlan(companyId);
  if (plan.branches === null) return true;
  return (await activeBranchCount(companyId)) < plan.branches;
}

// ---------- AI requests ----------

/** "2026-10": the calendar month (UTC) the allowance counts against. */
export function usageMonth(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export async function aiRequestsUsed(companyId: string): Promise<number> {
  const row = await db.aiUsage.findUnique({
    where: { companyId_month: { companyId, month: usageMonth() } },
    select: { requests: true },
  });
  return row?.requests ?? 0;
}

/** Bought AI requests (top-ups) still available. */
export async function aiCreditsLeft(companyId: string): Promise<number> {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { aiCredits: true } });
  return company?.aiCredits ?? 0;
}

/** Takes one AI request: from this month's plan allowance first, then from
 * bought top-ups. False when both are used up. Each step is a single
 * conditional update, so two requests at once can't both take the last one. */
export async function takeAiRequest(companyId: string): Promise<boolean> {
  const plan = await getCompanyPlan(companyId);
  const month = usageMonth();
  await db.aiUsage.upsert({
    where: { companyId_month: { companyId, month } },
    create: { companyId, month },
    update: {},
  });
  const taken = await db.aiUsage.updateMany({
    where: { companyId, month, requests: { lt: plan.aiRequests } },
    data: { requests: { increment: 1 } },
  });
  if (taken.count === 1) return true;
  const credit = await db.company.updateMany({
    where: { id: companyId, aiCredits: { gt: 0 } },
    data: { aiCredits: { decrement: 1 } },
  });
  return credit.count === 1;
}
