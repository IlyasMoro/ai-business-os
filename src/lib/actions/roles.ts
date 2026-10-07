"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@/generated/prisma/client";
import { CompanyRoleSchema, accessFromForm, parseRoleChoice, type CompanyRoleFormState } from "@/lib/validation/roles";

const ROLES = "/dashboard/team/roles";

function readRole(formData: FormData) {
  return CompanyRoleSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    baseRole: formData.get("baseRole"),
  });
}

/** Owner only: a new role for this company, with the modules ticked. */
export async function createCompanyRole(_state: CompanyRoleFormState, formData: FormData): Promise<CompanyRoleFormState> {
  const session = await requireRole(["OWNER"]);
  const parsed = readRole(formData);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const access = accessFromForm(formData, parsed.data.baseRole);
  if (Object.keys(access).length === 0) return { errors: { access: ["Give the role at least one module."] } };

  try {
    const role = await db.companyRole.create({ data: { companyId: session.companyId, ...parsed.data, access } });
    await logAudit(session.companyId, session.userId, "role.created", "CompanyRole", role.id, { name: role.name, access });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { errors: { name: ["There's already a role with this name."] } };
    throw e;
  }
  revalidatePath(ROLES);
  redirect(`${ROLES}?saved=1`);
}

/** Owner only: change a role. Its members move to the new level at once. */
export async function updateCompanyRole(roleId: string, _state: CompanyRoleFormState, formData: FormData): Promise<CompanyRoleFormState> {
  const session = await requireRole(["OWNER"]);
  const parsed = readRole(formData);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const access = accessFromForm(formData, parsed.data.baseRole);
  if (Object.keys(access).length === 0) return { errors: { access: ["Give the role at least one module."] } };

  const existing = await db.companyRole.findUnique({ where: { id: roleId, companyId: session.companyId }, select: { id: true } });
  if (!existing) redirect(`${ROLES}?error=invalid`);
  try {
    await db.$transaction([
      db.companyRole.update({ where: { id: roleId }, data: { ...parsed.data, access } }),
      // Members keep the role's level in their own record, which the
      // built in checks (manager pages) read.
      db.user.updateMany({ where: { companyId: session.companyId, companyRoleId: roleId, role: { not: "OWNER" } }, data: { role: parsed.data.baseRole } }),
      db.teamInvite.updateMany({ where: { companyId: session.companyId, companyRoleId: roleId, acceptedAt: null }, data: { role: parsed.data.baseRole } }),
    ]);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { errors: { name: ["There's already a role with this name."] } };
    throw e;
  }
  await logAudit(session.companyId, session.userId, "role.updated", "CompanyRole", roleId, { name: parsed.data.name, access });
  revalidatePath(ROLES);
  redirect(`${ROLES}?saved=1`);
}

/** Owner only: remove a role nobody holds. Ready made roles stay. */
export async function deleteCompanyRole(roleId: string) {
  const session = await requireRole(["OWNER"]);
  const role = await db.companyRole.findUnique({
    where: { id: roleId, companyId: session.companyId },
    select: { name: true, preset: true, _count: { select: { users: true, invites: { where: { acceptedAt: null } } } } },
  });
  if (!role || role.preset) redirect(`${ROLES}?error=invalid`);
  if (role._count.users > 0 || role._count.invites > 0) redirect(`${ROLES}?error=role-in-use`);
  await db.companyRole.delete({ where: { id: roleId } });
  await logAudit(session.companyId, session.userId, "role.deleted", "CompanyRole", roleId, { name: role.name });
  revalidatePath(ROLES);
  redirect(ROLES);
}

/** Owner only: give a member Admin, Employee or one of the company roles. */
export async function setMemberRole(userId: string, formData: FormData) {
  const back = "/dashboard/team";
  const session = await requireRole(["OWNER"]);
  const choice = parseRoleChoice(formData.get("role"));
  if (!choice || userId === session.userId) redirect(`${back}?error=invalid`);

  const target = await db.user.findUnique({ where: { id: userId, companyId: session.companyId }, select: { role: true } });
  // Owners are changed by an owner handing over, not from this menu.
  if (!target || target.role === "OWNER") redirect(`${back}?error=invalid`);

  let data: { role: "ADMIN" | "EMPLOYEE"; companyRoleId: string | null };
  if (choice.kind === "base") {
    data = { role: choice.role, companyRoleId: null };
  } else {
    const role = await db.companyRole.findUnique({ where: { id: choice.id, companyId: session.companyId }, select: { baseRole: true } });
    if (!role) redirect(`${back}?error=invalid`);
    data = { role: role.baseRole === "ADMIN" ? "ADMIN" : "EMPLOYEE", companyRoleId: choice.id };
  }
  await db.user.update({ where: { id: userId, companyId: session.companyId }, data });
  await logAudit(session.companyId, session.userId, "user.role_changed", "User", userId, data);
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}
