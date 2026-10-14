import { NextResponse, type NextRequest } from "next/server";
import { verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { verifySessionAnywhere } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { passkeyRelyingParty, takeChallenge } from "@/lib/passkeys";

/** Step two of adding a passkey: checks the device's answer to this
 *  browser's challenge and keeps the new public key. */
export async function POST(request: NextRequest) {
  const session = await verifySessionAnywhere();
  const body = (await request.json().catch(() => null)) as { response?: RegistrationResponseJSON; name?: string } | null;
  if (!body?.response) return NextResponse.json({ error: "Nothing to check." }, { status: 400 });

  const expectedChallenge = await takeChallenge("register", session.userId);
  if (!expectedChallenge) {
    return NextResponse.json({ error: "That took too long. Try adding the passkey again." }, { status: 400 });
  }

  const { rpID, origin } = passkeyRelyingParty();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch {
    return NextResponse.json({ error: "Your device's answer could not be checked. Try again." }, { status: 400 });
  }
  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Your device's answer could not be checked. Try again." }, { status: 400 });
  }

  const { credential, credentialBackedUp } = verification.registrationInfo;
  const name = (body.name ?? "").trim().slice(0, 60) || "Passkey";
  const existing = await db.passkey.findUnique({ where: { credentialId: credential.id }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "This passkey is already added." }, { status: 409 });

  await db.passkey.create({
    data: {
      userId: session.userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      backedUp: credentialBackedUp,
      name,
    },
  });
  await logAudit(session.companyId, session.userId, "account.passkey_added", "User", session.userId, { name });
  return NextResponse.json({ ok: true });
}
