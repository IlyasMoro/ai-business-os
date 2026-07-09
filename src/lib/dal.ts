import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionPayload, deleteSession, type SessionPayload } from "@/lib/session";
import { db } from "@/lib/db";
import { hasRole } from "@/lib/roles";

export { hasRole };

export const verifySession = cache(async () => {
  const session = await getSessionPayload();
  if (!session?.userId) {
    redirect("/login");
  }
  return session;
});

/** Page-level guard: redirects to the dashboard with an error banner if the
 * signed-in user's role isn't allowed. Use for whole modules (HR, Payroll,
 * Accounting) that only OWNER/ADMIN should be able to view at all. */
export async function requireRole(allowed: SessionPayload["role"][]) {
  const session = await verifySession();
  if (!hasRole(session, allowed)) {
    redirect("/dashboard?error=forbidden");
  }
  return session;
}

export const getOptionalSession = cache(async () => {
  return getSessionPayload();
});

export const getCurrentUser = cache(async () => {
  const session = await verifySession();
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      companyId: true,
      company: { select: { id: true, name: true, industry: true } },
    },
  });
  if (!user) {
    await deleteSession();
    redirect("/login");
  }
  return user;
});
