import "server-only";
import { db } from "@/lib/db";
import { cleanAccess, MODULES, moduleHref, PRESET_ROLES, type RoleAccess } from "@/lib/role-access";

/** Adds any ready made role the company doesn't have yet (they are made
 * once, then belong to the company and can be edited, never removed). */
export async function ensurePresetRoles(companyId: string) {
  const existing = await db.companyRole.findMany({ where: { companyId }, select: { preset: true, name: true } });
  const missing = PRESET_ROLES.filter((p) => !existing.some((e) => e.preset === p.preset || e.name === p.name));
  if (missing.length === 0) return;
  await db.companyRole.createMany({
    data: missing.map((p) => ({ companyId, name: p.name, description: p.description, baseRole: p.baseRole, access: p.access, preset: p.preset })),
    skipDuplicates: true,
  });
}

/** The company's roles with how many members and open invites use each. */
export async function listCompanyRoles(companyId: string) {
  await ensurePresetRoles(companyId);
  const roles = await db.companyRole.findMany({
    where: { companyId },
    orderBy: [{ preset: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    include: { _count: { select: { users: true, invites: { where: { acceptedAt: null } } } } },
  });
  return roles.map((r) => ({ ...r, access: cleanAccess(r.access, r.baseRole === "ADMIN" ? "ADMIN" : "EMPLOYEE") }));
}

/** Menu addresses this access can't open, to hide from the menu and search. */
export function hiddenByRole(access: RoleAccess | null): string[] {
  if (!access) return [];
  const hidden = MODULES.filter((m) => !access[m.key]).map((m) => moduleHref(m.key));
  // Branch performance lives under Reports.
  if (!access.reports) hidden.push("/dashboard/reports/branches");
  return hidden;
}
