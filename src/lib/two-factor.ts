import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, startSecondStep, type SecondStepTicket } from "@/lib/session";
import { openSecret } from "@/lib/secret-box";
import { hashRecoveryCode, matchTotp } from "@/lib/totp";

/**
 * The last step of every sign in (password, Google, Microsoft): people with
 * two step sign in go to /login/verify for their code, everyone else is in.
 */
export async function finishSignIn(
  user: { id: string; companyId: string; role: "OWNER" | "ADMIN" | "EMPLOYEE"; name: string; email: string; twoFactorEnabledAt: Date | null },
  { remember, via }: { remember: boolean; via: SecondStepTicket["via"] }
): Promise<never> {
  if (user.twoFactorEnabledAt) {
    await startSecondStep({ userId: user.id, remember, via });
    redirect("/login/verify");
  }
  await createSession({ userId: user.id, companyId: user.companyId, role: user.role, name: user.name, email: user.email, remember });
  redirect("/dashboard");
}

export type CodeCheck = { ok: true; usedRecoveryCode: boolean; recoveryCodesLeft: number } | { ok: false };

/**
 * Checks a 6 digit app code or a recovery code for this user and burns it:
 * an app code's step is remembered so it cannot be replayed, a recovery
 * code is removed. Only for users with two step sign in turned on.
 */
export async function checkSecondStepCode(userId: string, code: string): Promise<CodeCheck> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorEnabledAt: true, twoFactorLastStep: true, twoFactorRecoveryCodes: true },
  });
  if (!user?.twoFactorEnabledAt || !user.twoFactorSecret) return { ok: false };

  const typed = code.trim();
  if (/^\d[\d\s]*$/.test(typed)) {
    const secret = openSecret(user.twoFactorSecret);
    if (!secret) return { ok: false };
    const step = matchTotp(secret, typed, { lastStep: user.twoFactorLastStep });
    if (step === null) return { ok: false };
    // Only one request can move lastStep past this step, so a code raced
    // in twice is still accepted once.
    const claimed = await db.user.updateMany({
      where: { id: userId, OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: step } }] },
      data: { twoFactorLastStep: step },
    });
    return claimed.count === 1 ? { ok: true, usedRecoveryCode: false, recoveryCodesLeft: user.twoFactorRecoveryCodes.length } : { ok: false };
  }

  const hash = hashRecoveryCode(typed);
  if (!user.twoFactorRecoveryCodes.includes(hash)) return { ok: false };
  // Removed in one statement, so the same code cannot be spent twice and two
  // different codes used at once cannot undo each other.
  const removed = await db.$executeRaw`
    UPDATE "User" SET "twoFactorRecoveryCodes" = array_remove("twoFactorRecoveryCodes", ${hash})
    WHERE "id" = ${userId} AND ${hash} = ANY("twoFactorRecoveryCodes")`;
  return removed === 1
    ? { ok: true, usedRecoveryCode: true, recoveryCodesLeft: user.twoFactorRecoveryCodes.length - 1 }
    : { ok: false };
}
