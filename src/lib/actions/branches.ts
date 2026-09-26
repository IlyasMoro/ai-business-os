"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/lib/db";
import { verifySession, hasRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { BRANCH_COOKIE, ensureMainBranch, getBranchContext } from "@/lib/branches";

const BASE = "/dashboard/branches";

const BranchSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .transform((v) => v.toUpperCase()),
  address: z.string().trim().max(300).optional(),
});

async function requireAdmin(back: string) {
  const session = await verifySession();
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect(`${back}?error=forbidden`);
  return session;
}

const text = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" && v.trim() ? v : undefined;
};

export async function createBranch(formData: FormData) {
  const session = await requireAdmin(BASE);
  const validated = BranchSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    address: text(formData, "address"),
  });
  if (!validated.success) redirect(`${BASE}?error=invalid`);

  await ensureMainBranch(session.companyId);
  const exists = await db.branch.findUnique({
    where: { companyId_code: { companyId: session.companyId, code: validated.data.code } },
    select: { id: true },
  });
  if (exists) redirect(`${BASE}?error=branch-duplicate`);

  const branch = await db.branch.create({ data: { ...validated.data, companyId: session.companyId } });
  await logAudit(session.companyId, session.userId, "branch.created", "Branch", branch.id, { code: branch.code });
  revalidatePath("/dashboard", "layout");
  redirect(`${BASE}?saved=1`);
}

export async function updateBranch(branchId: string, formData: FormData) {
  const session = await requireAdmin(BASE);
  const validated = BranchSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    address: text(formData, "address"),
  });
  if (!validated.success) redirect(`${BASE}?error=invalid`);

  const clash = await db.branch.findFirst({
    where: { companyId: session.companyId, code: validated.data.code, id: { not: branchId } },
    select: { id: true },
  });
  if (clash) redirect(`${BASE}?error=branch-duplicate`);

  await db.branch.update({
    where: { id: branchId, companyId: session.companyId },
    data: { ...validated.data, address: validated.data.address ?? null },
  });
  await logAudit(session.companyId, session.userId, "branch.updated", "Branch", branchId, { code: validated.data.code });
  revalidatePath("/dashboard", "layout");
  redirect(`${BASE}?saved=1`);
}

/** Branches are deactivated, never deleted, so their history stays intact. */
export async function setBranchActive(branchId: string, active: boolean) {
  const session = await requireAdmin(BASE);
  const branch = await db.branch.findUnique({
    where: { id: branchId, companyId: session.companyId },
    select: { isMain: true },
  });
  if (!branch) redirect(`${BASE}?error=invalid`);
  if (branch.isMain && !active) redirect(`${BASE}?error=branch-main`);

  await db.branch.update({ where: { id: branchId, companyId: session.companyId }, data: { active } });
  await logAudit(session.companyId, session.userId, active ? "branch.activated" : "branch.deactivated", "Branch", branchId, {});
  revalidatePath("/dashboard", "layout");
  redirect(`${BASE}?saved=1`);
}

export async function makeMainBranch(branchId: string) {
  const session = await requireAdmin(BASE);
  const target = await db.branch.findUnique({
    where: { id: branchId, companyId: session.companyId },
    select: { active: true },
  });
  if (!target) redirect(`${BASE}?error=invalid`);
  if (!target.active) redirect(`${BASE}?error=branch-inactive`);

  await db.$transaction([
    db.branch.updateMany({ where: { companyId: session.companyId, isMain: true }, data: { isMain: false } }),
    db.branch.update({ where: { id: branchId, companyId: session.companyId }, data: { isMain: true } }),
  ]);
  await logAudit(session.companyId, session.userId, "branch.made_main", "Branch", branchId, {});
  revalidatePath("/dashboard", "layout");
  redirect(`${BASE}?saved=1`);
}

/**
 * Top bar switcher. Stores the choice in a cookie; locked employees are
 * ignored here as well as in getBranchContext, so a crafted request can't
 * widen their view.
 */
export async function selectBranch(branchId: string) {
  const ctx = await getBranchContext();
  if (!ctx.canSwitch) return;
  const cookieStore = await cookies();
  const valid = ctx.branches.some((b) => b.id === branchId);
  if (valid) {
    cookieStore.set(BRANCH_COOKIE, branchId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    cookieStore.delete(BRANCH_COOKIE);
  }
  revalidatePath("/dashboard", "layout");
}

/** Team page: limit an employee to one branch, or give them every branch. */
export async function setUserBranchAccess(userId: string, formData: FormData) {
  const back = "/dashboard/team";
  const session = await requireAdmin(back);
  const raw = formData.get("branchId");
  const branchId = typeof raw === "string" && raw ? raw : null;

  if (branchId) {
    const branch = await db.branch.findUnique({
      where: { id: branchId, companyId: session.companyId },
      select: { active: true },
    });
    if (!branch) redirect(`${back}?error=invalid`);
    if (!branch.active) redirect(`${back}?error=branch-inactive`);
  }

  const target = await db.user.findUnique({
    where: { id: userId, companyId: session.companyId },
    select: { role: true },
  });
  if (!target) redirect(`${back}?error=invalid`);

  await db.user.update({ where: { id: userId, companyId: session.companyId }, data: { branchId } });
  await logAudit(session.companyId, session.userId, "user.branch_access", "User", userId, { branchId });
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}
