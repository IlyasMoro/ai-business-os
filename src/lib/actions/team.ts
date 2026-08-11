"use server";

import { randomBytes, createHash } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import { sendEmailForCompany } from "@/lib/email-for-company";
import { logAudit } from "@/lib/audit";
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
  const { email, role } = validated.data;

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    return { message: "Someone with this email already has an account." };
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
      companyId: session.companyId,
      invitedByUserId: session.userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
    update: {
      role,
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

  await logAudit(session.companyId, session.userId, "team.invited", "TeamInvite", email, { role });

  revalidatePath("/dashboard/team");
  return { message: `Invite sent to ${email}.` };
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

  const passwordHash = await hashPassword(validated.data.password);

  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: validated.data.name,
        email: invite.email,
        passwordHash,
        role: invite.role,
        companyId: invite.companyId,
      },
    });
    await tx.teamInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    return created;
  });

  await createSession({
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
    name: user.name,
    email: user.email,
  });

  redirect("/dashboard");
}
