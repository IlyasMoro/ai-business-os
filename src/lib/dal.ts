import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionPayload, type SessionPayload } from "@/lib/session";
import { db } from "@/lib/db";
import { hasRole } from "@/lib/roles";
import { cleanAccess, decideAccess, type RoleAccess } from "@/lib/role-access";

export { hasRole };

/**
 * The signed-in user, checked against the database once per request: the
 * account must still exist in the same company, the sign-in must be newer
 * than the last password change (which signs out other devices), and the
 * role comes from the database, so a removed member or a changed role takes
 * effect at once instead of when the 7 day sign-in expires.
 */
export const verifySessionAnywhere = cache(async () => {
  const session = await getSessionPayload();
  if (!session?.userId) {
    redirect("/login");
  }
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, companyId: true, sessionsValidAfter: true, companyRole: { select: { access: true, baseRole: true } } },
  });
  const issuedMs = (session.iat ?? 0) * 1000;
  if (!user || user.companyId !== session.companyId || (user.sessionsValidAfter && issuedMs < user.sessionsValidAfter.getTime())) {
    // Cookies can only be cleared from a route handler, so go through one.
    redirect("/api/session/clear");
  }
  // A company role limits which modules the member can open; owners are
  // never limited. Null means the plain Admin or Employee access.
  const access: RoleAccess | null =
    user.role !== "OWNER" && user.companyRole ? cleanAccess(user.companyRole.access, user.companyRole.baseRole === "ADMIN" ? "ADMIN" : "EMPLOYEE") : null;
  return { ...session, role: user.role, access };
});

/**
 * verifySessionAnywhere plus the member's company role: every page and
 * every save inside a module they can't open is refused, and a module they
 * may only view refuses saves. The page address comes from the proxy
 * (x-pathname); a server action is recognised by its Next-Action header.
 * Saves that belong to no module (search, branch switch, sign out) use
 * verifySessionAnywhere instead.
 */
export const verifySession = cache(async () => {
  const session = await verifySessionAnywhere();
  if (session.access) {
    const h = await headers();
    const path = h.get("x-pathname");
    const decision = decideAccess(session.access, path, h.has("next-action"));
    if (decision === "no-access") redirect("/dashboard?error=no-access");
    if (decision === "view-only") redirect(`${path}?error=view-only`);
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
    // Session cookie references a user/company that no longer exists (e.g.
    // it was deleted). Cookies can only be deleted from a Server Function or
    // Route Handler, not a plain Server Component render, so route through
    // one to actually clear it — otherwise the proxy keeps treating the
    // still-valid JWT as authenticated and bounces /login back here forever.
    redirect("/api/session/clear");
  }
  return user;
});
