import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { verifySessionAnywhere } from "@/lib/dal";
import { exchangeCode, isOAuthProvider, takeOAuthRequest, type OAuthIdentity } from "@/lib/oauth-login";
import { finishSignIn } from "@/lib/two-factor";

/* Google / Microsoft send the browser back here.

   Signing in finds the person by the provider's own id (ExternalLogin).
   With no link yet, a Google address Google has verified is matched to the
   AIBOS user with that email and linked. Microsoft addresses are not proof
   of ownership on their own, so a Microsoft account must first be connected
   from My account while signed in. Nobody gets a new account this way:
   sign up stays on /register. */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(request.url);
  const base = process.env.APP_BASE_URL ?? url.origin;
  const to = (path: string) => NextResponse.redirect(new URL(path, base));

  if (!isOAuthProvider(provider)) return to("/login?oauth=failed");
  const req = await takeOAuthRequest(provider);
  const code = url.searchParams.get("code");
  const back = req?.mode === "link" ? "/dashboard/account" : "/login";

  // Cancelled at the provider, a stale tab, or a forged return.
  if (!req || !code || url.searchParams.get("error") || url.searchParams.get("state") !== req.state) {
    return to(`${back}?oauth=failed`);
  }

  let identity: OAuthIdentity;
  try {
    identity = await exchangeCode(req, code);
  } catch (error) {
    console.error("[oauth] exchange failed", error);
    return to(`${back}?oauth=failed`);
  }

  if (req.mode === "link") return link(identity, to);

  const linked = await db.externalLogin.findUnique({
    where: { provider_subject: { provider, subject: identity.subject } },
    include: { user: true },
  });
  let user = linked?.user ?? null;

  if (!user && identity.email) {
    const byEmail = await db.user.findUnique({ where: { email: identity.email } });
    if (byEmail && identity.emailVerified) {
      // Google vouches for this address: link it for next time.
      await db.externalLogin.upsert({
        where: { userId_provider: { userId: byEmail.id, provider } },
        create: { userId: byEmail.id, provider, subject: identity.subject, email: identity.email },
        update: { subject: identity.subject, email: identity.email },
      });
      user = byEmail;
    } else if (byEmail) {
      return to("/login?oauth=link-first");
    }
  }

  if (!user) return to(`/login?oauth=no-account`);
  if (user.lockedUntil && user.lockedUntil > new Date()) return to("/login?oauth=locked");

  // Redirects into the app, or to /login/verify for the code.
  return finishSignIn(user, { remember: req.remember, via: provider });
}

async function link(identity: OAuthIdentity, to: (path: string) => NextResponse) {
  const session = await verifySessionAnywhere();
  const taken = await db.externalLogin.findUnique({
    where: { provider_subject: { provider: identity.provider, subject: identity.subject } },
    select: { userId: true },
  });
  if (taken && taken.userId !== session.userId) return to("/dashboard/account?oauth=taken#sign-in-methods");

  await db.externalLogin.upsert({
    where: { userId_provider: { userId: session.userId, provider: identity.provider } },
    create: { userId: session.userId, provider: identity.provider, subject: identity.subject, email: identity.email },
    update: { subject: identity.subject, email: identity.email },
  });
  await logAudit(session.companyId, session.userId, "account.login_linked", "User", session.userId, { provider: identity.provider });
  return to(`/dashboard/account?saved=linked-${identity.provider}#sign-in-methods`);
}
