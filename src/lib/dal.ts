import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionPayload, type SessionPayload } from "@/lib/session";
import { db } from "@/lib/db";
import { hasRole } from "@/lib/roles";

export { hasRole };

/**
 * The signed-in user, checked against the database once per request: the
 * account must still exist in the same company, the sign-in must be newer
 * than the last password change (which signs out other devices), and the
 * role comes from the database, so a removed member or a changed role takes
 * effect at once instead of when the 7 day sign-in expires.
 */
export const verifySession = cache(async () => {
  const session = await getSessionPayload();
  if (!session?.userId) {
    redirect("/login");
  }
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, companyId: true, sessionsValidAfter: true },
  });
  const issuedMs = (session.iat ?? 0) * 1000;
  if (!user || user.companyId !== session.companyId || (user.sessionsValidAfter && issuedMs < user.sessionsValidAfter.getTime())) {
    // Cookies can only be cleared from a route handler, so go through one.
    redirect("/api/session/clear");
  }
  return { ...session, role: user.role };
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
    // Session cookie references a user/company that no longer exists (e.g.
    // it was deleted). Cookies can only be deleted from a Server Function or
    // Route Handler, not a plain Server Component render, so route through
    // one to actually clear it — otherwise the proxy keeps treating the
    // still-valid JWT as authenticated and bounces /login back here forever.
    redirect("/api/session/clear");
  }
  return user;
});
