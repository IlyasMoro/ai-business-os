import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { passkeyRelyingParty, saveChallenge } from "@/lib/passkeys";

/** Step one of signing in with a passkey: a fresh challenge for the device
 *  to sign. No email is asked for: the device offers the passkeys it has
 *  for this site, so nothing here reveals who has an account. */
export async function POST() {
  const ip = await getClientIp();
  if (!(await checkRateLimit(`passkey:${ip}`, { max: 30, windowMs: 15 * 60 * 1000 }))) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const { rpID } = passkeyRelyingParty();
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });
  await saveChallenge(options.challenge, "login");
  return NextResponse.json(options);
}
