import { NextResponse, type NextRequest } from "next/server";
import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { passkeyRelyingParty, takeChallenge } from "@/lib/passkeys";

const FAILED = "That passkey didn't work. Try again, or sign in with your email and password.";

/** Step two of signing in with a passkey: checks the device's signature
 *  over this browser's challenge, then signs the person in. A passkey
 *  already checked their fingerprint, face or PIN, so the authenticator
 *  app step is not asked for (see lib/passkeys.ts). */
export async function POST(request: NextRequest) {
  const ip = await getClientIp();
  if (!(await checkRateLimit(`passkey:${ip}`, { max: 30, windowMs: 15 * 60 * 1000 }))) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { response?: AuthenticationResponseJSON } | null;
  if (!body?.response?.id) return NextResponse.json({ error: FAILED }, { status: 400 });

  const expectedChallenge = await takeChallenge("login");
  if (!expectedChallenge) {
    return NextResponse.json({ error: "That took too long. Try the passkey again." }, { status: 400 });
  }

  const passkey = await db.passkey.findUnique({
    where: { credentialId: body.response.id },
    include: {
      user: { select: { id: true, companyId: true, role: true, name: true, email: true, lockedUntil: true } },
    },
  });
  // A passkey removed from the account, or one made for another site.
  if (!passkey) return NextResponse.json({ error: FAILED }, { status: 400 });

  // The device says whose passkey this is; it must be the same account.
  const handle = body.response.response.userHandle;
  if (handle && Buffer.from(handle, "base64url").toString("utf8") !== passkey.userId) {
    return NextResponse.json({ error: FAILED }, { status: 400 });
  }

  if (passkey.user.lockedUntil && passkey.user.lockedUntil > new Date()) {
    return NextResponse.json({ error: "Too many failed attempts. Please try again in 15 minutes." }, { status: 423 });
  }

  const { rpID, origin } = passkeyRelyingParty();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports as AuthenticatorTransport[],
      },
    });
  } catch {
    return NextResponse.json({ error: FAILED }, { status: 400 });
  }
  if (!verification.verified) return NextResponse.json({ error: FAILED }, { status: 400 });

  await db.passkey.update({
    where: { id: passkey.id },
    data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
  });
  const { user } = passkey;
  await createSession({ userId: user.id, companyId: user.companyId, role: user.role, name: user.name, email: user.email, remember: false });
  return NextResponse.json({ ok: true, redirect: "/dashboard" });
}
