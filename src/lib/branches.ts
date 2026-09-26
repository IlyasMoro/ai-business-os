import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import {
  branchFilter,
  branchForNewRecord,
  canAccessRecord,
  resolveBranchScope,
  type BranchOption,
  type BranchScope,
} from "@/lib/branch-access";

/** Cookie holding the top bar switcher's choice ("" or missing = all branches). */
export const BRANCH_COOKIE = "aibos-branch";

/**
 * Every company has a main branch. Companies created before branches existed
 * got one from the migration; this also covers new signups and anything that
 * slipped through, so callers can rely on it.
 */
export async function ensureMainBranch(companyId: string): Promise<string> {
  const main = await db.branch.findFirst({ where: { companyId, isMain: true }, select: { id: true } });
  if (main) return main.id;
  const created = await db.branch.upsert({
    where: { companyId_code: { companyId, code: "MAIN" } },
    update: { isMain: true, active: true },
    create: { companyId, name: "Main branch", code: "MAIN", isMain: true },
    select: { id: true },
  });
  return created.id;
}

export const getCompanyBranches = cache(async (companyId: string): Promise<BranchOption[]> => {
  await ensureMainBranch(companyId);
  return db.branch.findMany({
    where: { companyId },
    orderBy: [{ isMain: "desc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, isMain: true, active: true },
  });
});

export type BranchContext = BranchScope & {
  companyId: string;
  branches: BranchOption[];
  /** The branch in view as an object, or null for "All branches". */
  viewBranch: BranchOption | null;
  /** Whether the top bar switcher is usable (false for locked employees). */
  canSwitch: boolean;
};

/**
 * The signed-in user's branch scope for this request. The lock is read from
 * the database each time (not the session token), so changing someone's
 * branch access on the Team page applies on their very next click.
 */
export const getBranchContext = cache(async (): Promise<BranchContext> => {
  const session = await verifySession();
  const [branches, user, cookieStore] = await Promise.all([
    getCompanyBranches(session.companyId),
    db.user.findUnique({ where: { id: session.userId }, select: { role: true, branchId: true } }),
    cookies(),
  ]);
  const scope = resolveBranchScope({
    role: user?.role ?? session.role,
    userBranchId: user?.branchId ?? null,
    selectedBranchId: cookieStore.get(BRANCH_COOKIE)?.value || null,
    branches,
  });
  return {
    ...scope,
    companyId: session.companyId,
    branches,
    viewBranch: branches.find((b) => b.id === scope.viewBranchId) ?? null,
    canSwitch: !scope.lockedBranchId,
  };
});

/** `where` fragment for branch aware lists and counts. */
export async function branchWhere() {
  return branchFilter(await getBranchContext());
}

/**
 * `where` fragment for opening or changing one record: locked users only
 * match their own branch, so other branches' records look missing. Unlike
 * branchWhere it ignores the switcher, so links from "All branches" views
 * keep working after switching.
 */
export async function lockedWhere(): Promise<{ branchId?: string }> {
  const { lockedBranchId } = await getBranchContext();
  return lockedBranchId ? { branchId: lockedBranchId } : {};
}

/**
 * Page and action guard: 404 when a locked user reaches another branch's
 * record, so the record's existence isn't even confirmed.
 */
export async function assertBranchAccess(recordBranchId: string | null) {
  if (!canAccessRecord(await getBranchContext(), recordBranchId)) notFound();
}

/** Branch to stamp on a record being created from a form (field "branchId"). */
export async function resolveNewRecordBranch(formData?: FormData): Promise<string | null> {
  const ctx = await getBranchContext();
  const requested = formData?.get("branchId");
  return branchForNewRecord(ctx, typeof requested === "string" ? requested : null, ctx.branches);
}

/**
 * Options for a create form's Branch field, or null when there is nothing
 * to choose: locked users, or companies with a single active branch.
 */
export async function branchPicker(): Promise<{ options: { id: string; name: string; code: string }[]; defaultId: string } | null> {
  const ctx = await getBranchContext();
  if (!ctx.canSwitch) return null;
  const active = ctx.branches.filter((b) => b.active);
  if (active.length < 2) return null;
  const defaultId = branchForNewRecord(ctx, null, ctx.branches) ?? active[0].id;
  return { options: active.map(({ id, name, code }) => ({ id, name, code })), defaultId };
}

/** For records created by the system (automations, EDI, AI): the main branch. */
export async function systemBranchId(companyId: string): Promise<string> {
  return ensureMainBranch(companyId);
}
