"use server";

import { randomBytes, createHash } from "crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import {
  LoginSchema,
  RegisterSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  type LoginFormState,
  type RegisterFormState,
  type ForgotPasswordFormState,
  type ResetPasswordFormState,
} from "@/lib/validation/auth";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function register(
  _state: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> {
  const ip = await getClientIp();
  const allowed = await checkRateLimit(`register:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 });
  if (!allowed) {
    return { message: "Too many signup attempts. Please try again later." };
  }

  const validated = RegisterSchema.safeParse({
    companyName: formData.get("companyName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { companyName, name, email, password } = validated.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { message: "An account with this email already exists." };
  }

  const passwordHash = await hashPassword(password);

  const TRIAL_LENGTH_MS = 14 * 24 * 60 * 60 * 1000;

  const user = await db.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: companyName },
    });
    await tx.subscription.create({
      data: {
        companyId: company.id,
        status: "TRIALING",
        trialEndsAt: new Date(Date.now() + TRIAL_LENGTH_MS),
      },
    });
    return tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "OWNER",
        companyId: company.id,
      },
    });
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

export async function login(
  _state: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const validated = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { email, password } = validated.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    // Backstop for attempts against emails that don't exist, since there's no
    // user row to attach a per-account lockout to.
    const ip = await getClientIp();
    const allowed = await checkRateLimit(`login:${ip}`, { max: 10, windowMs: 15 * 60 * 1000 });
    if (!allowed) {
      return { message: "Too many attempts. Please try again later." };
    }
    return { message: "Invalid email or password." };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { message: "Too many failed attempts. Please try again in 15 minutes." };
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    const failedLoginAttempts = user.failedLoginAttempts + 1;
    const lockedUntil =
      failedLoginAttempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;

    await db.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts, lockedUntil },
    });

    return {
      message: lockedUntil
        ? "Too many failed attempts. Please try again in 15 minutes."
        : "Invalid email or password.",
    };
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
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

export async function logout() {
  await deleteSession();
  redirect("/login");
}

async function getAppOrigin() {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function requestPasswordReset(
  _state: ForgotPasswordFormState,
  formData: FormData
): Promise<ForgotPasswordFormState> {
  const validated = ForgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const genericMessage = "If an account exists for that email, we've sent a password reset link.";

  const ip = await getClientIp();
  const allowed = await checkRateLimit(`password-reset:${ip}`, { max: 5, windowMs: 15 * 60 * 1000 });
  if (!allowed) {
    // Don't reveal that rate limiting kicked in — same generic response either way.
    return { message: genericMessage };
  }

  const user = await db.user.findUnique({
    where: { email: validated.data.email },
    select: { id: true, name: true, email: true },
  });

  if (user) {
    const rawToken = randomBytes(32).toString("hex");
    await db.passwordResetToken.create({
      data: {
        tokenHash: hashToken(rawToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const resetUrl = `${await getAppOrigin()}/reset-password/${rawToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        html: `<p>Hi ${user.name},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
      });
    } catch {
      // Swallow send failures — surfacing them would confirm the account
      // exists, and the user can't act on a delivery failure anyway.
    }
  }

  return { message: genericMessage };
}

export async function resetPassword(
  token: string,
  _state: ResetPasswordFormState,
  formData: FormData
): Promise<ResetPasswordFormState> {
  const validated = ResetPasswordSchema.safeParse({
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const resetToken = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return { message: "This reset link is invalid or has expired. Please request a new one." };
  }

  const passwordHash = await hashPassword(validated.data.password);

  await db.$transaction([
    db.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    }),
    db.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  redirect("/login?reset=success");
}
