"use server";

import { redirect } from "next/navigation";
import { verifySessionAnywhere } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isOAuthProvider } from "@/lib/oauth-login";

/** Disconnects Google or Microsoft from the signed in person; the password keeps working. */
export async function unlinkExternalLogin(formData: FormData) {
  const session = await verifySessionAnywhere();
  const provider = String(formData.get("provider") ?? "");
  if (!isOAuthProvider(provider)) redirect("/dashboard/account#sign-in-methods");

  await db.externalLogin.deleteMany({ where: { userId: session.userId, provider } });
  await logAudit(session.companyId, session.userId, "account.login_unlinked", "User", session.userId, { provider });
  redirect("/dashboard/account?saved=unlinked#sign-in-methods");
}

/** Removes one of the signed in person's passkeys; the password keeps working. */
export async function removePasskey(formData: FormData) {
  const session = await verifySessionAnywhere();
  const id = String(formData.get("id") ?? "");
  // Scoped to the person, so nobody can remove someone else's passkey.
  const removed = await db.passkey.findFirst({ where: { id, userId: session.userId }, select: { name: true } });
  if (removed) {
    await db.passkey.deleteMany({ where: { id, userId: session.userId } });
    await logAudit(session.companyId, session.userId, "account.passkey_removed", "User", session.userId, { name: removed.name });
  }
  redirect("/dashboard/account?saved=passkey-removed#passkeys");
}
