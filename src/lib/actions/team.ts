"use server";

import { randomBytes, createHash } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { parseRoleChoice } from "@/lib/validation/roles";
import { createSession } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import { sendEmailForCompany } from "@/lib/email-for-company";
import { logAudit } from "@/lib/audit";
import { getCompanyPlan, userRoom } from "@/lib/plan-limits";
import { syncExtraUsers } from "@/lib/billing-seats";
import { EXTRA_USER_PRICE, MAX_USERS } from "@/lib/plans";
import {
  InviteTeamMemberSchema,
  AcceptInviteSchema,
  type InviteTeamMemberFormState,
  type AcceptInviteFormState,
} from "@/lib/validation/team";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getAppOrigin() {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function inviteTeamMember(
  _state: InviteTeamMemberFormState,
  formData: FormData
): Promise<InviteTeamMemberFormState> {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const validated = InviteTeamMemberSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }
  const { email } = validated.data;
  // A company role brings its own level; plain Admin or Employee have none.
  const choice = parseRoleChoice(validated.data.role);
  if (!choice) return { errors: { role: ["Select a valid role."] } };
  let role: "ADMIN" | "EMPLOYEE";
  let companyRoleId: string | null = null;
  if (choice.kind === "base") {
    role = choice.role;
  } else {
    const companyRole = await db.companyRole.findUnique({ where: { id: choice.id, companyId: session.companyId }, select: { baseRole: true } });
    if (!companyRole) return { errors: { role: ["Select a valid role."] } };
    role = companyRole.baseRole === "ADMIN" ? "ADMIN" : "EMPLOYEE";
    companyRoleId = choice.id;
  }

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    return { message: "Someone with this email already has an account." };
  }

  // Re-sending an open invite keeps the seat it already holds.
  const openInvite = await db.teamInvite.findFirst({
    where: { companyId: session.companyId, email, acceptedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  const room = await userRoom(session.companyId, { pendingInvite: Boolean(openInvite) });
  if (room === "full") {
    return {
      message: `AIBOS plans go up to ${MAX_USERS} users, counting open invites. Remove someone or revoke an invite, or move to Enterprise on the Billing page, which takes more.`,
    };
  }
  if (room === "plan-full") {
    const plan = await getCompanyPlan(session.companyId);
    return {
      message:
        plan.id === "scale"
          ? `Your ${plan.name} plan has room for ${plan.users} users, counting open invites. To add more, the owner can add users to the plan on the Billing page.`
          : `The ${plan.name} plan includes ${plan.users} users, counting open invites. To add more, the owner can move to Starter on the Billing page.`,
    };
  }
  if (room === "needs-plan") {
    const plan = await getCompanyPlan(session.companyId);
    return {
      message: `Your plan includes ${plan.users} users, counting open invites. To add more, the owner can subscribe to a plan on the Billing page; extra users are then $${EXTRA_USER_PRICE} each a month.`,
    };
  }

  const company = await db.company.findUnique({
    where: { id: session.companyId },
    select: { name: true },
  });

  const rawToken = randomBytes(32).toString("hex");

  await db.teamInvite.upsert({
    where: { companyId_email: { companyId: session.companyId, email } },
    create: {
      email,
      role,
      companyRoleId,
      companyId: session.companyId,
      invitedByUserId: session.userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
    update: {
      role,
      companyRoleId,
      invitedByUserId: session.userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      acceptedAt: null,
    },
  });

  const inviteUrl = `${await getAppOrigin()}/invite/${rawToken}`;

  try {
    await sendEmailForCompany(session.companyId, {
      to: email,
      subject: `You're invited to join ${company?.name ?? "a company"} on AIBOS`,
      html: `<p>You've been invited to join <strong>${company?.name ?? "a company"}</strong> on AIBOS.</p><p><a href="${inviteUrl}">${inviteUrl}</a></p><p>This link expires in 7 days.</p>`,
    });
  } catch (err) {
    console.error("[team] invite email failed:", err);
    return { message: "Could not send the invite email. Please try again." };
  }

  await logAudit(session.companyId, session.userId, "team.invited", "TeamInvite", email, { role, companyRoleId });

  revalidatePath("/dashboard/team");
  return {
    message:
      room === "extra"
        ? `Invite sent to ${email}. Once they join they're an extra user, $${EXTRA_USER_PRICE} a month, charged from that day.`
        : `Invite sent to ${email}.`,
  };
}

export async function revokeInvite(inviteId: string) {
  const session = await requireRole(["OWNER", "ADMIN"]);

  await db.teamInvite.delete({
    where: { id: inviteId, companyId: session.companyId },
  });

  revalidatePath("/dashboard/team");
}

export async function removeTeamMember(userId: string) {
  const session = await requireRole(["OWNER"]);

  if (userId === session.userId) {
    redirect("/dashboard/team?error=invalid");
  }

  const target = await db.user.findUnique({
    where: { id: userId, companyId: session.companyId },
    select: { id: true, role: true },
  });
  if (!target) {
    redirect("/dashboard/team?error=invalid");
  }

  if (target.role === "OWNER") {
    const ownerCount = await db.user.count({ where: { companyId: session.companyId, role: "OWNER" } });
    if (ownerCount <= 1) {
      redirect("/dashboard/team?error=last-owner");
    }
  }

  await db.user.delete({ where: { id: userId, companyId: session.companyId } });
  // Credits the rest of the period if they were an extra user.
  await syncExtraUsers(session.companyId);

  await logAudit(session.companyId, session.userId, "team.member_removed", "User", userId, {});

  revalidatePath("/dashboard/team");
}

export async function acceptInvite(
  token: string,
  _state: AcceptInviteFormState,
  formData: FormData
): Promise<AcceptInviteFormState> {
  const validated = AcceptInviteSchema.safeParse({
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const invite = await db.teamInvite.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return { message: "This invite link is invalid or has expired." };
  }

  const existingUser = await db.user.findUnique({ where: { email: invite.email } });
  if (existingUser) {
    return { message: "An account with this email already exists. Try signing in instead." };
  }

  // The invite already holds a seat, unless it was revoked and resent or
  // the plan changed since it was sent.
  const room = await userRoom(invite.companyId, { pendingInvite: true });
  if (room === "full" || room === "needs-plan" || room === "plan-full") {
    return { message: "This team is full on its current plan. Ask whoever invited you to make room, then try again." };
  }

  const passwordHash = await hashPassword(validated.data.password);

  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: validated.data.name,
        email: invite.email,
        passwordHash,
        role: invite.role,
        companyRoleId: invite.companyRoleId,
        companyId: invite.companyId,
      },
    });
    await tx.teamInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    return created;
  });
  // A member above the plan's included users is billed from today.
  await syncExtraUsers(invite.companyId);

  await createSession({
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
    name: user.name,
    email: user.email,
  });

  redirect("/dashboard");
}
