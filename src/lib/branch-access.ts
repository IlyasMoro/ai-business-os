/* Pure branch access rules, kept free of database and request code so they
   can be unit tested. lib/branches.ts feeds them real data.

   The model:
   - Owners and admins manage the whole company. They can view "All
     branches" or pick one in the top bar switcher.
   - An employee can be limited to one branch (User.branchId). They then
     only see and create that branch's records, and the switcher is locked.
     Limiting is employee only on purpose: admin only pages such as
     Reports, Payroll and Accounting show company wide money. */

export type Role = "OWNER" | "ADMIN" | "EMPLOYEE";

export type BranchOption = { id: string; name: string; code: string; isMain: boolean; active: boolean };

export type BranchScope = {
  /** Branch the user is locked to, or null when they may see every branch. */
  lockedBranchId: string | null;
  /** Branch currently in view: the locked one, else the switcher's pick, else null for "All branches". */
  viewBranchId: string | null;
};

/** Only employees can be locked to a branch; owners and admins never are. */
export function effectiveLockedBranch(role: Role, userBranchId: string | null, branches: BranchOption[]): string | null {
  if (role !== "EMPLOYEE" || !userBranchId) return null;
  // A lock pointing at a missing branch fails closed to the main branch
  // rather than silently widening access to everything.
  if (branches.some((b) => b.id === userBranchId)) return userBranchId;
  return branches.find((b) => b.isMain)?.id ?? userBranchId;
}

export function resolveBranchScope(input: {
  role: Role;
  userBranchId: string | null;
  selectedBranchId: string | null | undefined;
  branches: BranchOption[];
}): BranchScope {
  const lockedBranchId = effectiveLockedBranch(input.role, input.userBranchId, input.branches);
  if (lockedBranchId) return { lockedBranchId, viewBranchId: lockedBranchId };

  const picked = input.selectedBranchId
    ? input.branches.find((b) => b.id === input.selectedBranchId)
    : undefined;
  return { lockedBranchId: null, viewBranchId: picked?.id ?? null };
}

/** Prisma `where` fragment for lists: every branch, or just the one in view. */
export function branchFilter(scope: BranchScope): { branchId?: string } {
  return scope.viewBranchId ? { branchId: scope.viewBranchId } : {};
}

/** Can this user open a record that belongs to `recordBranchId`? */
export function canAccessRecord(scope: BranchScope, recordBranchId: string | null): boolean {
  if (!scope.lockedBranchId) return true;
  return recordBranchId === scope.lockedBranchId;
}

/**
 * Branch to stamp on a new record. Locked users always create in their
 * branch whatever the form says; others get the form's choice when it is an
 * active branch, else the branch in view, else the main branch.
 */
export function branchForNewRecord(
  scope: BranchScope,
  requestedBranchId: string | null | undefined,
  branches: BranchOption[]
): string | null {
  if (scope.lockedBranchId) return scope.lockedBranchId;
  const active = branches.filter((b) => b.active);
  if (requestedBranchId && active.some((b) => b.id === requestedBranchId)) return requestedBranchId;
  if (scope.viewBranchId && active.some((b) => b.id === scope.viewBranchId)) return scope.viewBranchId;
  return active.find((b) => b.isMain)?.id ?? active[0]?.id ?? null;
}
