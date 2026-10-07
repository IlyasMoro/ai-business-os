"use server";

import { redirect } from "next/navigation";
import { verifySessionAnywhere } from "@/lib/dal";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { openSecret, sealSecret } from "@/lib/secret-box";
import { hashRecoveryCode, matchTotp, newRecoveryCodes, newTotpSecret } from "@/lib/totp";
import { checkSecondStepCode } from "@/lib/two-factor";

/* Two step sign in for the signed in person (My account): turn it on with
   an authenticator app, get new recovery codes, turn it off. Personal, so
   these use verifySessionAnywhere and work whatever the member's role. */

const BASE = "/dashboard/account";

export type TwoFactorFormState = { message?: string; recoveryCodes?: string[] } | undefined;

async function limited(userId: string) {
  return !(await checkRateLimit(`two-factor:${userId}`, { max: 8, windowMs: 15 * 60 * 1000 }));
}

/** Makes a fresh secret for the app to scan; nothing changes until a first code confirms it. */
export async function startTwoFactorSetup() {
  const session = await verifySessionAnywhere();
  await db.user.update({ where: { id: session.userId }, data: { twoFactorPendingSecret: sealSecret(newTotpSecret()) } });
  redirect(`${BASE}?setup=two-factor#two-factor`);
}

export async function cancelTwoFactorSetup() {
  const session = await verifySessionAnywhere();
  await db.user.update({ where: { id: session.userId }, data: { twoFactorPendingSecret: null } });
  redirect(`${BASE}#two-factor`);
}

/** A first code from the app proves it has the secret: two step sign in is on. */
export async function confirmTwoFactor(_state: TwoFactorFormState, formData: FormData): Promise<TwoFactorFormState> {
  const session = await verifySessionAnywhere();
  if (await limited(session.userId)) return { message: "Too many attempts. Wait 15 minutes, then try again." };

  const user = await db.user.findUnique({ where: { id: session.userId }, select: { twoFactorPendingSecret: true } });
  const secret = user?.twoFactorPendingSecret ? openSecret(user.twoFactorPendingSecret) : null;
  if (!secret) return { message: "The setup expired. Start again." };

  const step = matchTotp(secret, String(formData.get("code") ?? ""));
  if (step === null) return { message: "That code didn't match. Check the app shows AIBOS and try the newest code." };

  const recoveryCodes = newRecoveryCodes();
  await db.user.update({
    where: { id: session.userId },
    data: {
      twoFactorSecret: sealSecret(secret),
      twoFactorPendingSecret: null,
      twoFactorEnabledAt: new Date(),
      twoFactorLastStep: step,
      twoFactorRecoveryCodes: recoveryCodes.map(hashRecoveryCode),
    },
  });
  await logAudit(session.companyId, session.userId, "account.two_factor_enabled", "User", session.userId, {});
  // No revalidate here: the card must keep showing the codes until saved.
  return { recoveryCodes };
}

/** New recovery codes replace the old ones; needs a current app code. */
export async function regenerateRecoveryCodes(_state: TwoFactorFormState, formData: FormData): Promise<TwoFactorFormState> {
  const session = await verifySessionAnywhere();
  if (await limited(session.userId)) return { message: "Too many attempts. Wait 15 minutes, then try again." };

  // App codes only: checking a recovery code would spend it for nothing.
  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d[\d\s]*$/.test(code)) return { message: "Type a current code from your app." };
  const check = await checkSecondStepCode(session.userId, code);
  if (!check.ok) return { message: "Type a current code from your app." };

  const recoveryCodes = newRecoveryCodes();
  await db.user.update({ where: { id: session.userId }, data: { twoFactorRecoveryCodes: recoveryCodes.map(hashRecoveryCode) } });
  await logAudit(session.companyId, session.userId, "account.recovery_codes_renewed", "User", session.userId, {});
  // No revalidate: the codes stay on screen until the person is done.
  return { recoveryCodes };
}

/** Turning it off needs both the password and a code (app or recovery). */
export async function disableTwoFactor(_state: TwoFactorFormState, formData: FormData): Promise<TwoFactorFormState> {
  const session = await verifySessionAnywhere();
  if (await limited(session.userId)) return { message: "Too many attempts. Wait 15 minutes, then try again." };

  const user = await db.user.findUnique({ where: { id: session.userId }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(String(formData.get("password") ?? ""), user.passwordHash))) {
    return { message: "Your password isn't right. Nothing was changed." };
  }
  const check = await checkSecondStepCode(session.userId, String(formData.get("code") ?? ""));
  if (!check.ok) return { message: "That code didn't work. Nothing was changed." };

  await db.user.update({
    where: { id: session.userId },
    data: {
      twoFactorSecret: null,
      twoFactorPendingSecret: null,
      twoFactorEnabledAt: null,
      twoFactorLastStep: null,
      twoFactorRecoveryCodes: [],
    },
  });
  await logAudit(session.companyId, session.userId, "account.two_factor_disabled", "User", session.userId, {});
  redirect(`${BASE}?saved=two-factor-off#two-factor`);
}
