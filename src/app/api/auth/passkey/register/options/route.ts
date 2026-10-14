import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { verifySessionAnywhere } from "@/lib/dal";
import { db } from "@/lib/db";
import { PASSKEY_RP_NAME, passkeyRelyingParty, saveChallenge } from "@/lib/passkeys";

/** Step one of adding a passkey: the signed in person's device is asked to
 *  make a new key pair for this site. Their existing passkeys are listed so
 *  the same device can't be added twice. */
export async function POST() {
  const session = await verifySessionAnywhere();
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, passkeys: { select: { credentialId: true, transports: true } } },
  });
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { rpID } = passkeyRelyingParty();
  const options = await generateRegistrationOptions({
    rpName: PASSKEY_RP_NAME,
    rpID,
    userName: user.email,
    userDisplayName: user.name,
    // The user handle is the account id, so a sign in can be matched to it.
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: user.passkeys.map((p) => ({
      id: p.credentialId,
      transports: p.transports as AuthenticatorTransport[],
    })),
    // A discoverable passkey (no email needed to sign in) that always
    // checks the person's fingerprint, face or PIN.
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });

  await saveChallenge(options.challenge, "register", user.id);
  return NextResponse.json(options);
}
