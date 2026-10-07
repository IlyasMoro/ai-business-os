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
