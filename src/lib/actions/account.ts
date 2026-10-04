"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { createSession, sessionCutoffNow } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

/* The signed-in person's own account (/dashboard/account): their name and
   password. Company details live on Settings. */

const BASE = "/dashboard/account";

const NameSchema = z.object({ name: z.string().trim().min(2).max(100) });

const PasswordSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(8),
  confirm: z.string(),
});

export async function updateMyName(formData: FormData) {
  const session = await verifySession();
  const parsed = NameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) redirect(`${BASE}?error=account-name`);

  await db.user.update({ where: { id: session.userId }, data: { name: parsed.data.name } });
  // The name is also in the sign-in token (menu, greetings), so reissue it.
  await createSession({ userId: session.userId, companyId: session.companyId, role: session.role, name: parsed.data.name, email: session.email });

  revalidatePath("/dashboard", "layout");
  redirect(`${BASE}?saved=name`);
}

/** Changes the password after checking the current one, then signs out
 * every other device; this device gets a fresh sign-in and stays in. */
export async function changePassword(formData: FormData) {
  const session = await verifySession();

  // Guessing the current password from a stolen session is slowed down.
  if (!(await checkRateLimit(`change-password:${session.userId}`, { max: 5, windowMs: 15 * 60 * 1000 }))) {
    redirect(`${BASE}?error=account-rate`);
  }

  const parsed = PasswordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) redirect(`${BASE}?error=account-password-short`);
  const { current, next, confirm } = parsed.data;
  if (next !== confirm) redirect(`${BASE}?error=account-password-mismatch`);

  const user = await db.user.findUnique({ where: { id: session.userId }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(current, user.passwordHash))) redirect(`${BASE}?error=account-password-wrong`);
  if (await verifyPassword(next, user.passwordHash)) redirect(`${BASE}?error=account-password-same`);

  await db.user.update({
    where: { id: session.userId },
    data: { passwordHash: await hashPassword(next), sessionsValidAfter: sessionCutoffNow() },
  });
  await createSession({ userId: session.userId, companyId: session.companyId, role: session.role, name: session.name, email: session.email });
  await logAudit(session.companyId, session.userId, "account.password_changed", "User", session.userId, {});

  redirect(`${BASE}?saved=password`);
}
